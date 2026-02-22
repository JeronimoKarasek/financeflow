import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const status = searchParams.get('status')
    const franquiaId = searchParams.get('franquia_id')
    const isPessoal = searchParams.get('is_pessoal')
    const dataInicio = searchParams.get('data_inicio')
    const dataFim = searchParams.get('data_fim')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = createServerSupabase()
    let query = supabase
      .from('_financeiro_transacoes')
      .select('*, _financeiro_categorias(nome, cor, icone), _financeiro_franquias(nome), _financeiro_contas_bancarias!_financeiro_transacoes_conta_bancaria_id_fkey(nome, banco)', { count: 'exact' })
      .order('data_vencimento', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (tipo) query = query.eq('tipo', tipo)
    if (status) query = query.eq('status', status)
    if (franquiaId) query = query.eq('franquia_id', franquiaId)
    if (isPessoal === 'true') query = query.eq('is_pessoal', true)
    if (isPessoal === 'false') query = query.eq('is_pessoal', false)
    if (dataInicio) query = query.gte('data_vencimento', dataInicio)
    if (dataFim) query = query.lte('data_vencimento', dataFim)

    const { data, error, count } = await query

    if (error) throw error
    return NextResponse.json({ data, total: count, page, limit })
  } catch (error) {
    console.error('Transações GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar transações' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServerSupabase()

    // Limpar campos vazios para null (evitar erro de UUID vazio)
    const uuidFields = ['categoria_id', 'conta_bancaria_id', 'conta_destino_id', 'franquia_id', 'usuario_id']
    for (const field of uuidFields) {
      if (body[field] === '' || body[field] === undefined) body[field] = null
    }
    if (!body.data_pagamento) body.data_pagamento = null
    if (!body.recorrencia_tipo) body.recorrencia_tipo = null
    if (!body.observacoes) body.observacoes = null

    // Se for parcelado, criar múltiplas transações
    if (body.parcela_total && body.parcela_total > 1) {
      const grupoParcela = crypto.randomUUID()
      const transacoes = []
      
      for (let i = 0; i < body.parcela_total; i++) {
        const dataVencimento = new Date(body.data_vencimento)
        dataVencimento.setMonth(dataVencimento.getMonth() + i)
        
        transacoes.push({
          ...body,
          valor: (body.valor / body.parcela_total).toFixed(2),
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          parcela_atual: i + 1,
          grupo_parcela_id: grupoParcela,
        })
      }

      const { data, error } = await supabase
        .from('_financeiro_transacoes')
        .insert(transacoes)
        .select()

      if (error) throw error
      return NextResponse.json(data, { status: 201 })
    }

    const { data, error } = await supabase
      .from('_financeiro_transacoes')
      .insert(body)
      .select()
      .single()

    if (error) throw error

    // Atualizar saldo da conta bancária se pago
    if (body.status === 'pago' && body.conta_bancaria_id) {
      const { data: conta } = await supabase
        .from('_financeiro_contas_bancarias')
        .select('saldo_atual')
        .eq('id', body.conta_bancaria_id)
        .single()

      if (conta) {
        const novoSaldo = body.tipo === 'receita' 
          ? Number(conta.saldo_atual) + Number(body.valor)
          : Number(conta.saldo_atual) - Number(body.valor)

        await supabase
          .from('_financeiro_contas_bancarias')
          .update({ saldo_atual: novoSaldo })
          .eq('id', body.conta_bancaria_id)
      }
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Transações POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar transação' }, { status: 500 })
  }
}
