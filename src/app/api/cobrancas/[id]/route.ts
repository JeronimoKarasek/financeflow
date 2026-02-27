import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createServerSupabase()

    // Buscar cobrança atual para pegar transacao_id
    const { data: cobrancaAtual } = await supabase
      .from('_financeiro_cobrancas')
      .select('transacao_id')
      .eq('id', id)
      .single()

    const { data, error } = await supabase
      .from('_financeiro_cobrancas')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Atualizar transação vinculada
    if (cobrancaAtual?.transacao_id) {
      const transacaoUpdate: Record<string, unknown> = {}
      if (body.descricao !== undefined) transacaoUpdate.descricao = `[Cobrança] ${body.descricao}`
      if (body.valor !== undefined) transacaoUpdate.valor = body.valor
      if (body.data_vencimento !== undefined) transacaoUpdate.data_vencimento = body.data_vencimento
      if (body.tipo !== undefined) transacaoUpdate.tipo = body.tipo === 'receber' ? 'receita' : 'despesa'
      if (body.franquia_id !== undefined) transacaoUpdate.franquia_id = body.franquia_id || null
      if (body.is_pessoal !== undefined) transacaoUpdate.is_pessoal = body.is_pessoal
      if (body.status !== undefined) transacaoUpdate.status = body.status
      if (body.data_pagamento !== undefined) transacaoUpdate.data_pagamento = body.data_pagamento

      if (Object.keys(transacaoUpdate).length > 0) {
        await supabase
          .from('_financeiro_transacoes')
          .update(transacaoUpdate)
          .eq('id', cobrancaAtual.transacao_id)
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Cobrança PUT error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar cobrança' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerSupabase()

    // Buscar transacao_id antes de deletar
    const { data: cobranca } = await supabase
      .from('_financeiro_cobrancas')
      .select('transacao_id')
      .eq('id', id)
      .single()

    // Deletar a cobrança
    const { error } = await supabase
      .from('_financeiro_cobrancas')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Cancelar transação vinculada
    if (cobranca?.transacao_id) {
      await supabase
        .from('_financeiro_transacoes')
        .update({ status: 'cancelado' })
        .eq('id', cobranca.transacao_id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cobrança DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao excluir cobrança' }, { status: 500 })
  }
}
