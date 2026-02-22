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

    // Buscar transações do período
    let query = supabase
      .from('_financeiro_transacoes')
      .select('*')
      .gte('data_vencimento', dataInicioStr)
      .neq('status', 'cancelado')

    if (franquiaId) {
      query = query.eq('franquia_id', franquiaId)
    }

    const { data: transacoes } = await query

    // Calcular totais
    const totalReceitas = transacoes?.filter(t => t.tipo === 'receita' && t.status === 'pago')
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0
    const totalDespesas = transacoes?.filter(t => t.tipo === 'despesa' && t.status === 'pago')
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0
    const pendentes = transacoes?.filter(t => t.status === 'pendente').length || 0
    const atrasados = transacoes?.filter(t => t.status === 'atrasado').length || 0

    // Receitas/Despesas do mês atual
    const mesAtualInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
    const receitasMes = transacoes?.filter(t => t.tipo === 'receita' && t.status === 'pago' && t.data_vencimento >= mesAtualInicio)
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0
    const despesasMes = transacoes?.filter(t => t.tipo === 'despesa' && t.status === 'pago' && t.data_vencimento >= mesAtualInicio)
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0

    // Buscar franquias com saldo
    const { data: franquias } = await supabase
      .from('_financeiro_franquias')
      .select('id, nome, cor_tema')
      .eq('ativa', true)

    const franquiasComSaldo = await Promise.all(
      (franquias || []).map(async (f) => {
        const { data: transF } = await supabase
          .from('_financeiro_transacoes')
          .select('tipo, valor, status')
          .eq('franquia_id', f.id)
          .eq('status', 'pago')

        const receitas = transF?.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0) || 0
        const despesas = transF?.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0) || 0

        return { nome: f.nome, saldo: receitas - despesas, cor: f.cor_tema }
      })
    )

    // Buscar cobranças próximas
    const { data: cobrancas } = await supabase
      .from('_financeiro_cobrancas')
      .select('id, descricao, valor, data_vencimento, status')
      .in('status', ['pendente', 'atrasado'])
      .order('data_vencimento', { ascending: true })
      .limit(5)

    // Fluxo mensal (últimos 6 meses)
    const fluxoMensal = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0)
      const mesLabel = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      
      const receitas = transacoes?.filter(t => {
        const dt = new Date(t.data_vencimento)
        return t.tipo === 'receita' && t.status === 'pago' && dt >= d && dt <= fim
      }).reduce((s, t) => s + Number(t.valor), 0) || 0

      const despesas = transacoes?.filter(t => {
        const dt = new Date(t.data_vencimento)
        return t.tipo === 'despesa' && t.status === 'pago' && dt >= d && dt <= fim
      }).reduce((s, t) => s + Number(t.valor), 0) || 0

      fluxoMensal.push({ mes: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1), receitas, despesas })
    }

    // Categorias de despesa
    const { data: categorias } = await supabase
      .from('_financeiro_categorias')
      .select('id, nome, cor')
      .eq('tipo', 'despesa')

    const categoriasDespesas = await Promise.all(
      (categorias || []).slice(0, 5).map(async (cat) => {
        const { data: transC } = await supabase
          .from('_financeiro_transacoes')
          .select('valor')
          .eq('categoria_id', cat.id)
          .eq('tipo', 'despesa')
          .eq('status', 'pago')
          .gte('data_vencimento', dataInicioStr)

        return {
          nome: cat.nome,
          valor: transC?.reduce((s, t) => s + Number(t.valor), 0) || 0,
          cor: cat.cor,
        }
      })
    )

    return NextResponse.json({
      totalReceitas,
      totalDespesas,
      saldo: totalReceitas - totalDespesas,
      pendentes,
      atrasados,
      receitasMes,
      despesasMes,
      franquias: franquiasComSaldo,
      fluxoMensal,
      categoriasDespesas: categoriasDespesas.filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor),
      proximasCobrancas: (cobrancas || []).map(c => ({
        id: c.id,
        descricao: c.descricao,
        valor: Number(c.valor),
        vencimento: c.data_vencimento,
        status: c.status,
      })),
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 })
  }
}
