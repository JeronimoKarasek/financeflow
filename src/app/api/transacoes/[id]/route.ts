import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createServerSupabase()

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

    const { error } = await supabase
      .from('_financeiro_transacoes')
      .update({ status: 'cancelado' })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Transação DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao cancelar transação' }, { status: 500 })
  }
}
