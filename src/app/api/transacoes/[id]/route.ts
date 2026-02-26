import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createServerSupabase()

    // Limpar campos vazios para null (evitar FK constraint com strings vazias)
    const nullableFields = ['categoria_id', 'conta_bancaria_id', 'franquia_id', 'cartao_credito_id', 'data_pagamento', 'recorrencia_tipo', 'observacoes', 'usuario_id']
    for (const field of nullableFields) {
      if (body[field] === '' || body[field] === undefined) body[field] = null
    }

    // Buscar transação original antes de atualizar (para ajustar saldo)
    const { data: original } = await supabase
      .from('_financeiro_transacoes')
      .select('status, tipo, valor, conta_bancaria_id')
      .eq('id', id)
      .single()

    const { data, error } = await supabase
      .from('_financeiro_transacoes')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Ajustar saldo da conta bancária ao marcar como pago
    if (body.status === 'pago' && original && original.status !== 'pago') {
      const contaId = body.conta_bancaria_id || original.conta_bancaria_id
      if (contaId) {
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
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Transação PUT error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar transação' }, { status: 500 })
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
