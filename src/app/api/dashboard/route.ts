import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get('periodo') || 'mes'
    const franquiaId = searchParams.get('franquia_id')

    const supabase = createServerSupabase()
    const hoje = new Date()
    let dataInicio: Date

    switch (periodo) {
      case 'trimestre':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)
        break
      case 'ano':
        dataInicio = new Date(hoje.getFullYear(), 0, 1)
        break
      default:
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    }

    const dataInicioStr = dataInicio.toISOString().split('T')[0]

    // Buscar TODAS transações (para fluxo e comparativo) — últimos 12 meses
    const dozeAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1).toISOString().split('T')[0]
    let queryAll = supabase
      .from('_financeiro_transacoes')
      .select('*, _financeiro_categorias(nome, cor), _financeiro_franquias(nome)')
      .gte('data_vencimento', dozeAtras)
      .neq('status', 'cancelado')
    if (franquiaId) queryAll = queryAll.eq('franquia_id', franquiaId)
    const { data: todasTransacoes } = await queryAll

    // Transações do período selecionado
    const transacoes = (todasTransacoes || []).filter(t => t.data_vencimento >= dataInicioStr)

    // === TOTAIS ===
    const totalReceitas = transacoes.filter(t => t.tipo === 'receita' && t.status === 'pago')
      .reduce((sum, t) => sum + Number(t.valor), 0)
    const totalDespesas = transacoes.filter(t => t.tipo === 'despesa' && t.status === 'pago')
      .reduce((sum, t) => sum + Number(t.valor), 0)
    const pendentes = transacoes.filter(t => t.status === 'pendente').length
    const atrasados = transacoes.filter(t => t.status === 'atrasado').length

    // Valores pendentes e atrasados
    const receitasPendentes = transacoes.filter(t => t.tipo === 'receita' && t.status === 'pendente')
      .reduce((s, t) => s + Number(t.valor), 0)
    const despesasPendentes = transacoes.filter(t => t.tipo === 'despesa' && t.status === 'pendente')
      .reduce((s, t) => s + Number(t.valor), 0)
    const valorAtrasado = transacoes.filter(t => t.status === 'atrasado')
      .reduce((s, t) => s + Number(t.valor), 0)
    const totalReceitasPeriodo = transacoes.filter(t => t.tipo === 'receita')
      .reduce((s, t) => s + Number(t.valor), 0)
    const totalDespesasPeriodo = transacoes.filter(t => t.tipo === 'despesa')
      .reduce((s, t) => s + Number(t.valor), 0)

    // === MÊS ATUAL ===
    const mesAtualInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
    const receitasMes = transacoes.filter(t => t.tipo === 'receita' && t.status === 'pago' && t.data_vencimento >= mesAtualInicio)
      .reduce((sum, t) => sum + Number(t.valor), 0)
    const despesasMes = transacoes.filter(t => t.tipo === 'despesa' && t.status === 'pago' && t.data_vencimento >= mesAtualInicio)
      .reduce((sum, t) => sum + Number(t.valor), 0)

    // === COMPARATIVO MÊS ANTERIOR ===
    const mesAnteriorInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().split('T')[0]
    const mesAnteriorFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().split('T')[0]
    const allTrans = todasTransacoes || []
    const receitasMesAnterior = allTrans.filter(t => t.tipo === 'receita' && t.status === 'pago' && t.data_vencimento >= mesAnteriorInicio && t.data_vencimento <= mesAnteriorFim)
      .reduce((s, t) => s + Number(t.valor), 0)
    const despesasMesAnterior = allTrans.filter(t => t.tipo === 'despesa' && t.status === 'pago' && t.data_vencimento >= mesAnteriorInicio && t.data_vencimento <= mesAnteriorFim)
      .reduce((s, t) => s + Number(t.valor), 0)

    // === FRANQUIAS ===
    const { data: franquias } = await supabase
      .from('_financeiro_franquias')
      .select('id, nome, cor_tema')
      .eq('ativa', true)

    const franquiasComSaldo = (franquias || []).map(f => {
      const transF = allTrans.filter(t => t.franquia_id === f.id)
      const receitas = transF.filter(t => t.tipo === 'receita' && t.status === 'pago').reduce((s, t) => s + Number(t.valor), 0)
      const despesas = transF.filter(t => t.tipo === 'despesa' && t.status === 'pago').reduce((s, t) => s + Number(t.valor), 0)
      return { nome: f.nome, saldo: receitas - despesas, receitas, despesas, cor: f.cor_tema }
    })

    // === COBRANÇAS ===
    const { data: cobrancas } = await supabase
      .from('_financeiro_cobrancas')
      .select('id, descricao, valor, data_vencimento, status, tipo, nome_contato')
      .in('status', ['pendente', 'atrasado'])
      .order('data_vencimento', { ascending: true })
      .limit(8)

    // === FLUXO MENSAL (12 meses) ===
    const fluxoMensal = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0)
      const mesLabel = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')

      const receitas = allTrans.filter(t => {
        const dt = new Date(t.data_vencimento)
        return t.tipo === 'receita' && t.status === 'pago' && dt >= d && dt <= fim
      }).reduce((s, t) => s + Number(t.valor), 0)

      const despesas = allTrans.filter(t => {
        const dt = new Date(t.data_vencimento)
        return t.tipo === 'despesa' && t.status === 'pago' && dt >= d && dt <= fim
      }).reduce((s, t) => s + Number(t.valor), 0)

      fluxoMensal.push({ mes: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1), receitas, despesas, saldo: receitas - despesas })
    }

    // === CATEGORIAS (receita e despesa) ===
    const { data: catDespesas } = await supabase
      .from('_financeiro_categorias')
      .select('id, nome, cor')
      .eq('tipo', 'despesa')
    const { data: catReceitas } = await supabase
      .from('_financeiro_categorias')
      .select('id, nome, cor')
      .eq('tipo', 'receita')

    const buildCategorias = (cats: typeof catDespesas, tipo: string) => {
      return (cats || []).map(cat => {
        const total = transacoes.filter(t => t.categoria_id === cat.id && t.tipo === tipo && t.status !== 'cancelado')
          .reduce((s, t) => s + Number(t.valor), 0)
        return { nome: cat.nome, valor: total, cor: cat.cor }
      }).filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 8)
    }

    const categoriasDespesas = buildCategorias(catDespesas, 'despesa')
    const categoriasReceitas = buildCategorias(catReceitas, 'receita')

    // === TOP TRANSAÇÕES ===
    const topReceitas = transacoes
      .filter(t => t.tipo === 'receita' && t.status !== 'cancelado')
      .sort((a, b) => Number(b.valor) - Number(a.valor))
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        descricao: t.descricao,
        valor: Number(t.valor),
        data_vencimento: t.data_vencimento,
        status: t.status,
        categoria: t._financeiro_categorias?.nome || null,
        franquia: t._financeiro_franquias?.nome || null,
      }))

    const topDespesas = transacoes
      .filter(t => t.tipo === 'despesa' && t.status !== 'cancelado')
      .sort((a, b) => Number(b.valor) - Number(a.valor))
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        descricao: t.descricao,
        valor: Number(t.valor),
        data_vencimento: t.data_vencimento,
        status: t.status,
        categoria: t._financeiro_categorias?.nome || null,
        franquia: t._financeiro_franquias?.nome || null,
      }))

    // === ÚLTIMAS TRANSAÇÕES ===
    const ultimasTransacoes = transacoes
      .sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento))
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        descricao: t.descricao,
        valor: Number(t.valor),
        tipo: t.tipo,
        data_vencimento: t.data_vencimento,
        status: t.status,
        categoria: t._financeiro_categorias?.nome || null,
        franquia: t._financeiro_franquias?.nome || null,
      }))

    return NextResponse.json({
      totalReceitas,
      totalDespesas,
      saldo: totalReceitas - totalDespesas,
      pendentes,
      atrasados,
      receitasMes,
      despesasMes,
      receitasPendentes,
      despesasPendentes,
      valorAtrasado,
      totalReceitasPeriodo,
      totalDespesasPeriodo,
      receitasMesAnterior,
      despesasMesAnterior,
      franquias: franquiasComSaldo,
      fluxoMensal,
      categoriasDespesas,
      categoriasReceitas,
      topReceitas,
      topDespesas,
      ultimasTransacoes,
      proximasCobrancas: (cobrancas || []).map(c => ({
        id: c.id,
        descricao: c.descricao,
        valor: Number(c.valor),
        vencimento: c.data_vencimento,
        status: c.status,
        tipo: c.tipo,
        nome_contato: c.nome_contato,
      })),
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 })
  }
}
