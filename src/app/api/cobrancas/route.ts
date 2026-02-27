import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const status = searchParams.get('status')
    const franquiaId = searchParams.get('franquia_id')

    const supabase = createServerSupabase()
    let query = supabase
      .from('_financeiro_cobrancas')
      .select('*, _financeiro_franquias(nome)')
      .order('data_vencimento', { ascending: true })

    if (tipo) query = query.eq('tipo', tipo)
    if (status) query = query.eq('status', status)
    if (franquiaId) query = query.eq('franquia_id', franquiaId)

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Cobranças GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar cobranças' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServerSupabase()

    // 1) Criar a cobrança
    const { data: cobranca, error } = await supabase
      .from('_financeiro_cobrancas')
      .insert(body)
      .select()
      .single()

    if (error) throw error

    // 2) Criar transação vinculada
    try {
      const transacaoData: Record<string, unknown> = {
        descricao: `[Cobrança] ${body.descricao}`,
        valor: body.valor,
        tipo: body.tipo === 'receber' ? 'receita' : 'despesa',
        status: 'pendente',
        data_vencimento: body.data_vencimento,
        franquia_id: body.franquia_id || null,
        is_pessoal: body.is_pessoal || false,
        observacoes: `Gerado automaticamente pela cobrança: ${cobranca.id}`,
      }

      const { data: transacao } = await supabase
        .from('_financeiro_transacoes')
        .insert(transacaoData)
        .select()
        .single()

      if (transacao) {
        await supabase
          .from('_financeiro_cobrancas')
          .update({ transacao_id: transacao.id })
          .eq('id', cobranca.id)
        cobranca.transacao_id = transacao.id
      }
    } catch (e) {
      console.error('Erro ao criar transação da cobrança:', e)
    }

    return NextResponse.json(cobranca, { status: 201 })
  } catch (error) {
    console.error('Cobranças POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar cobrança' }, { status: 500 })
  }
}
