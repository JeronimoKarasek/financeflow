import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createServerSupabase()

    // Whitelist de colunas permitidas para update (evitar enviar campos inexistentes)
    const allowedFields = [
      'tipo', 'descricao', 'valor', 'data_vencimento', 'data_pagamento', 'status',
      'categoria_id', 'conta_bancaria_id', 'conta_destino_id', 'franquia_id',
      'is_pessoal', 'recorrente', 'recorrencia_tipo', 'recorrencia_fim',
      'parcela_atual', 'parcela_total', 'observacoes', 'tags',
      'comprovante_url', 'origem_integracao', 'id_externo',
      'cartao_credito_id', 'usuario_id',
    ]
    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        // Limpar FKs e campos de texto vazios para null
        const val = body[field]
        if (val === '' || val === undefined) {
          updateData[field] = null
        } else {
          updateData[field] = val
        }
      }
    }

    // Buscar transação original antes de atualizar (para ajustar saldo)
    const { data: original } = await supabase
      .from('_financeiro_transacoes')
      .select('status, tipo, valor, conta_bancaria_id')
      .eq('id', id)
      .single()

    const { data, error } = await supabase
      .from('_financeiro_transacoes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Transação PUT Supabase error:', error)
      // Se erro é coluna inexistente (ex: cartao_credito_id), tentar sem ela
      if (error.message?.includes('cartao_credito_id') || error.code === '42703') {
        delete updateData.cartao_credito_id
        const { data: retry, error: retryErr } = await supabase
          .from('_financeiro_transacoes')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()
        if (retryErr) {
          return NextResponse.json({ error: retryErr.message || 'Erro ao atualizar transação', code: retryErr.code }, { status: 500 })
        }
        // Continuar com lógica de saldo usando retry data
        if (body.status === 'pago' && original && original.status !== 'pago') {
          await ajustarSaldo(supabase, body, original, retry)
        }
        return NextResponse.json(retry)
      }
      return NextResponse.json({ error: error.message || 'Erro ao atualizar transação', code: error.code }, { status: 500 })
    }

    // Ajustar saldo da conta bancária ao marcar como pago
    if (body.status === 'pago' && original && original.status !== 'pago') {
      await ajustarSaldo(supabase, body, original, data)
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Transação PUT error:', error)
    const msg = error instanceof Error ? error.message : 'Erro ao atualizar transação'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ajustarSaldo(supabase: any, body: any, original: any, data: any) {
  const contaId = body.conta_bancaria_id || original.conta_bancaria_id
  if (!contaId) return
  const { data: conta } = await supabase
    .from('_financeiro_contas_bancarias')
    .select('saldo_atual')
    .eq('id', contaId)
    .single()
  if (conta) {
    const tipo = data?.tipo || original.tipo
    const valor = Number(data?.valor || original.valor)
    const novoSaldo = tipo === 'receita'
      ? Number(conta.saldo_atual) + valor
      : Number(conta.saldo_atual) - valor
    await supabase
      .from('_financeiro_contas_bancarias')
      .update({ saldo_atual: novoSaldo })
      .eq('id', contaId)
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerSupabase()

    // Reverter saldo se a transação estava paga
    const { data: original } = await supabase
      .from('_financeiro_transacoes')
      .select('status, tipo, valor, conta_bancaria_id')
      .eq('id', id)
      .single()

    if (original && original.status === 'pago' && original.conta_bancaria_id) {
      const { data: conta } = await supabase
        .from('_financeiro_contas_bancarias')
        .select('saldo_atual')
        .eq('id', original.conta_bancaria_id)
        .single()

      if (conta) {
        const valor = Number(original.valor)
        const novoSaldo = original.tipo === 'receita'
          ? Number(conta.saldo_atual) - valor
          : Number(conta.saldo_atual) + valor

        await supabase
          .from('_financeiro_contas_bancarias')
          .update({ saldo_atual: novoSaldo })
          .eq('id', original.conta_bancaria_id)
      }
    }

    const { error } = await supabase
      .from('_financeiro_transacoes')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Transação DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao excluir transação' }, { status: 500 })
  }
}
