import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET: buscar faturas de um cartão
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cartaoId = searchParams.get('cartao_id')
    const ano = searchParams.get('ano')
    const mes = searchParams.get('mes')

    const supabase = createServerSupabase()
    let query = supabase
      .from('_financeiro_faturas_cartao')
      .select('*, _financeiro_cartoes_credito(nome, bandeira, banco)')
      .order('ano_referencia', { ascending: false })
      .order('mes_referencia', { ascending: false })

    if (cartaoId) query = query.eq('cartao_credito_id', cartaoId)
    if (ano) query = query.eq('ano_referencia', parseInt(ano))
    if (mes) query = query.eq('mes_referencia', parseInt(mes))

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Faturas GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar faturas' }, { status: 500 })
  }
}

// GET gastos de uma fatura (transações vinculadas ao cartão naquele mês)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cartao_id, mes, ano } = body

    if (!cartao_id || !mes || !ano) {
      return NextResponse.json({ error: 'cartao_id, mes e ano obrigatórios' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    // Buscar o cartão para saber o dia de fechamento
    const { data: cartao } = await supabase
      .from('_financeiro_cartoes_credito')
      .select('dia_fechamento, dia_vencimento')
      .eq('id', cartao_id)
      .single()

    if (!cartao) {
      return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 })
    }

    // Período da fatura: do fechamento do mês anterior até fechamento deste mês
    const diaFechamento = cartao.dia_fechamento
    const mesAnterior = mes === 1 ? 12 : mes - 1
    const anoAnterior = mes === 1 ? ano - 1 : ano
    const dataInicio = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(diaFechamento).padStart(2, '0')}`
    const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(diaFechamento).padStart(2, '0')}`

    // Buscar transações do cartão neste período
    const { data: transacoes, error } = await supabase
      .from('_financeiro_transacoes')
      .select('*, _financeiro_categorias(nome, cor, icone)')
      .eq('cartao_credito_id', cartao_id)
      .gte('data_vencimento', dataInicio)
      .lt('data_vencimento', dataFim)
      .order('data_vencimento', { ascending: false })

    if (error) throw error

    // Calcular total da fatura
    const totalFatura = (transacoes || []).reduce((sum, t) => sum + Number(t.valor), 0)

    // Upsert na fatura
    const dataVencimento = `${ano}-${String(mes).padStart(2, '0')}-${String(cartao.dia_vencimento).padStart(2, '0')}`
    
    await supabase
      .from('_financeiro_faturas_cartao')
      .upsert({
        cartao_credito_id: cartao_id,
        mes_referencia: mes,
        ano_referencia: ano,
        data_fechamento: dataFim,
        data_vencimento: dataVencimento,
        valor_total: totalFatura,
      }, { onConflict: 'cartao_credito_id,mes_referencia,ano_referencia' })

    return NextResponse.json({ transacoes, total: totalFatura })
  } catch (error) {
    console.error('Faturas POST error:', error)
    return NextResponse.json({ error: 'Erro ao buscar fatura' }, { status: 500 })
  }
}
