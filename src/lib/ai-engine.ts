// ============================================================
// FAROL FINANCE - Motor IA Central
// Cérebro que alimenta: Consultor WhatsApp, Insights, 
// Análise Preditiva, Relatórios, Orçamento, Cobrança, etc.
// ============================================================

import OpenAI from 'openai'
import { createServerSupabase } from '@/lib/supabase'

// ============================================================
// CONFIGURAÇÃO: busca API key do OpenAI nas integrações
// ============================================================
export async function getOpenAIConfig(): Promise<{ apiKey: string; model: string } | null> {
  try {
    const supabase = createServerSupabase()

    // 1) Tentar buscar da tabela de integrações (provedor = openai)
    const { data: integ } = await supabase
      .from('_financeiro_integracoes')
      .select('api_key, configuracoes_extra')
      .eq('provedor', 'openai')
      .eq('ativa', true)
      .limit(1)
      .single() as { data: { api_key: string | null; configuracoes_extra: Record<string, string> | null } | null }

    if (integ?.api_key) {
      return {
        apiKey: integ.api_key,
        model: integ.configuracoes_extra?.model || 'gpt-4o-mini',
      }
    }

    // 2) Fallback: tabela de preferências (campo antigo)
    const { data: prefs } = await supabase
      .from('_financeiro_preferencias_notificacao')
      .select('openai_api_key')
      .not('openai_api_key', 'is', null)
      .limit(1)
      .single() as { data: { openai_api_key: string | null } | null }

    if (prefs?.openai_api_key) {
      return { apiKey: prefs.openai_api_key, model: 'gpt-4o-mini' }
    }

    return null
  } catch {
    return null
  }
}

export function createOpenAI(apiKey: string) {
  return new OpenAI({ apiKey })
}

// ============================================================
// CONTEXTO FINANCEIRO: coleta dados para alimentar a IA
// ============================================================
export async function coletarContextoFinanceiro() {
  const supabase = createServerSupabase()
  const hoje = new Date()
  const mesAtualInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
  const mesAtualFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]
  const tresMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1).toISOString().split('T')[0]
  const dozeMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1).toISOString().split('T')[0]

  // Buscar tudo em paralelo
  const [
    contasRes,
    transacoesMesRes,
    transacoes3mRes,
    pendentesRes,
    atrasadosRes,
    categoriasRes,
    cartoesRes,
    cobrancasRes,
    orcamentosRes,
    franquiasRes,
  ] = await Promise.all([
    supabase.from('_financeiro_contas_bancarias').select('nome, banco, saldo_atual, tipo').eq('ativa', true),
    supabase.from('_financeiro_transacoes').select('tipo, valor, descricao, status, data_vencimento, categoria_id, franquia_id')
      .gte('data_vencimento', mesAtualInicio).lte('data_vencimento', mesAtualFim).neq('status', 'cancelado'),
    supabase.from('_financeiro_transacoes').select('tipo, valor, descricao, status, data_vencimento, data_pagamento, categoria_id, franquia_id, recorrente')
      .gte('data_vencimento', tresMesesAtras).neq('status', 'cancelado'),
    supabase.from('_financeiro_transacoes').select('descricao, valor, data_vencimento, tipo')
      .eq('status', 'pendente').order('data_vencimento', { ascending: true }).limit(20),
    supabase.from('_financeiro_transacoes').select('descricao, valor, data_vencimento, tipo')
      .eq('status', 'atrasado').order('data_vencimento', { ascending: true }),
    supabase.from('_financeiro_categorias').select('id, nome, tipo').eq('ativa', true),
    supabase.from('_financeiro_cartoes_credito').select('nome, bandeira, limite_total, limite_usado, dia_fechamento, dia_vencimento').eq('ativo', true),
    supabase.from('_financeiro_cobrancas').select('descricao, valor, data_vencimento, status, tipo, nome_contato')
      .in('status', ['pendente', 'atrasado']).order('data_vencimento').limit(15),
    supabase.from('_financeiro_orcamentos').select('valor_planejado, categoria_id, mes, ano')
      .eq('mes', hoje.getMonth() + 1).eq('ano', hoje.getFullYear()),
    supabase.from('_financeiro_franquias').select('id, nome').eq('ativa', true),
  ])

  const contas = (contasRes.data || []) as { nome: string; banco: string | null; saldo_atual: number; tipo: string }[]
  const transacoesMes = (transacoesMesRes.data || []) as { tipo: string; valor: number; descricao: string; status: string; data_vencimento: string; categoria_id: string | null; franquia_id: string | null }[]
  const transacoes3m = (transacoes3mRes.data || []) as { tipo: string; valor: number; descricao: string; status: string; data_vencimento: string; data_pagamento: string | null; categoria_id: string | null; franquia_id: string | null; recorrente: boolean }[]
  const pendentes = (pendentesRes.data || []) as { descricao: string; valor: number; data_vencimento: string; tipo: string }[]
  const atrasados = (atrasadosRes.data || []) as { descricao: string; valor: number; data_vencimento: string; tipo: string }[]
  const categorias = (categoriasRes.data || []) as { id: string; nome: string; tipo: string }[]
  const cartoes = (cartoesRes.data || []) as { nome: string; bandeira: string; limite_total: number; limite_usado: number; dia_fechamento: number; dia_vencimento: number }[]
  const cobrancas = (cobrancasRes.data || []) as { descricao: string; valor: number; data_vencimento: string; status: string; tipo: string; nome_contato: string | null }[]
  const orcamentos = (orcamentosRes.data || []) as { valor_planejado: number; categoria_id: string; mes: number; ano: number }[]
  const franquias = (franquiasRes.data || []) as { id: string; nome: string }[]

  // Calcular totais do mês
  const receitasMes = transacoesMes.filter(t => t.tipo === 'receita' && t.status === 'pago').reduce((s, t) => s + Number(t.valor), 0)
  const despesasMes = transacoesMes.filter(t => t.tipo === 'despesa' && t.status === 'pago').reduce((s, t) => s + Number(t.valor), 0)
  const saldoContas = contas.reduce((s, c) => s + Number(c.saldo_atual), 0)

  // Gastos por categoria (top 10 do mês)
  const gastosPorCat: Record<string, number> = {}
  for (const t of transacoesMes.filter(t => t.tipo === 'despesa')) {
    const catNome = categorias.find(c => c.id === t.categoria_id)?.nome || 'Sem categoria'
    gastosPorCat[catNome] = (gastosPorCat[catNome] || 0) + Number(t.valor)
  }
  const topCategorias = Object.entries(gastosPorCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, valor]) => `${nome}: R$${valor.toFixed(2)}`)

  // Gastos por franquia
  const gastosPorFranq: Record<string, { receitas: number; despesas: number }> = {}
  for (const t of transacoesMes) {
    const fNome = franquias.find(f => f.id === t.franquia_id)?.nome || 'Sem franquia'
    if (!gastosPorFranq[fNome]) gastosPorFranq[fNome] = { receitas: 0, despesas: 0 }
    if (t.tipo === 'receita') gastosPorFranq[fNome].receitas += Number(t.valor)
    else gastosPorFranq[fNome].despesas += Number(t.valor)
  }

  // Fluxo últimos 3 meses
  const fluxo3m: { mes: string; receitas: number; despesas: number }[] = []
  for (let i = 2; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const rec = transacoes3m.filter(t => t.tipo === 'receita' && t.status === 'pago' && new Date(t.data_vencimento) >= d && new Date(t.data_vencimento) <= fim).reduce((s, t) => s + Number(t.valor), 0)
    const desp = transacoes3m.filter(t => t.tipo === 'despesa' && t.status === 'pago' && new Date(t.data_vencimento) >= d && new Date(t.data_vencimento) <= fim).reduce((s, t) => s + Number(t.valor), 0)
    fluxo3m.push({ mes: label, receitas: rec, despesas: desp })
  }

  // Transações recorrentes
  const recorrentes = transacoes3m.filter(t => t.recorrente).length

  // Orçamentos vs realizado
  const orcStatus = orcamentos.map(o => {
    const cat = categorias.find(c => c.id === o.categoria_id)
    const realizado = transacoesMes
      .filter(t => t.categoria_id === o.categoria_id && t.tipo === 'despesa')
      .reduce((s, t) => s + Number(t.valor), 0)
    return {
      categoria: cat?.nome || 'Desconhecida',
      planejado: Number(o.valor_planejado),
      realizado,
      pct: Number(o.valor_planejado) > 0 ? Math.round((realizado / Number(o.valor_planejado)) * 100) : 0,
    }
  })

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  return {
    resumo: `
📅 Data atual: ${hoje.toLocaleDateString('pt-BR')}

💰 SALDO EM CONTAS:
${contas.map(c => `• ${c.nome} (${c.banco || c.tipo}): ${fmt(Number(c.saldo_atual))}`).join('\n')}
Total: ${fmt(saldoContas)}

📊 MÊS ATUAL (${hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}):
• Receitas pagas: ${fmt(receitasMes)}
• Despesas pagas: ${fmt(despesasMes)}
• Saldo do mês: ${fmt(receitasMes - despesasMes)}

📈 FLUXO ÚLTIMOS 3 MESES:
${fluxo3m.map(f => `• ${f.mes}: Receitas ${fmt(f.receitas)} | Despesas ${fmt(f.despesas)} | Saldo ${fmt(f.receitas - f.despesas)}`).join('\n')}

🏷️ TOP GASTOS POR CATEGORIA (MÊS):
${topCategorias.join('\n')}

🏢 POR FRANQUIA/EMPRESA (MÊS):
${Object.entries(gastosPorFranq).map(([n, v]) => `• ${n}: Receita ${fmt(v.receitas)} | Despesa ${fmt(v.despesas)}`).join('\n')}

💳 CARTÕES DE CRÉDITO:
${cartoes.length > 0 ? cartoes.map(c => `• ${c.nome} (${c.bandeira}): Usado ${fmt(Number(c.limite_usado))} de ${fmt(Number(c.limite_total))} (${Number(c.limite_total) > 0 ? Math.round((Number(c.limite_usado) / Number(c.limite_total)) * 100) : 0}%)`).join('\n') : 'Nenhum cartão cadastrado'}

⏳ CONTAS PENDENTES (próximas ${pendentes.length}):
${pendentes.slice(0, 10).map(p => `• ${p.descricao}: ${fmt(Number(p.valor))} vence ${new Date(p.data_vencimento).toLocaleDateString('pt-BR')} (${p.tipo})`).join('\n') || 'Nenhuma'}

🔴 CONTAS ATRASADAS (${atrasados.length}):
${atrasados.slice(0, 10).map(a => `• ${a.descricao}: ${fmt(Number(a.valor))} venceu ${new Date(a.data_vencimento).toLocaleDateString('pt-BR')} (${a.tipo})`).join('\n') || 'Nenhuma'}

📋 COBRANÇAS ATIVAS (${cobrancas.length}):
${cobrancas.slice(0, 10).map(c => `• ${c.descricao}: ${fmt(Number(c.valor))} - ${c.status} - ${c.tipo === 'receber' ? 'A receber de' : 'A pagar'} ${c.nome_contato || ''}`).join('\n') || 'Nenhuma'}

🎯 ORÇAMENTOS DO MÊS:
${orcStatus.length > 0 ? orcStatus.map(o => `• ${o.categoria}: ${fmt(o.realizado)} / ${fmt(o.planejado)} (${o.pct}%)`).join('\n') : 'Nenhum orçamento definido'}

🔁 Transações recorrentes/fixas: ${recorrentes}
`.trim(),
    dados: {
      contas, transacoesMes, transacoes3m, pendentes, atrasados,
      categorias, cartoes, cobrancas, orcamentos, franquias,
      receitasMes, despesasMes, saldoContas, gastosPorCat,
      gastosPorFranq, fluxo3m, orcStatus, recorrentes,
    },
  }
}

// ============================================================
// CHAT: Conversar com a IA sobre finanças
// ============================================================
export async function chatFinanceiro(
  mensagem: string,
  config: { apiKey: string; model: string }
): Promise<string> {
  const openai = createOpenAI(config.apiKey)
  const contexto = await coletarContextoFinanceiro()

  const response = await openai.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: `Você é o Assistente Financeiro IA do Farol Finance — um consultor financeiro pessoal e empresarial altamente qualificado.

REGRAS:
- Responda SEMPRE em português do Brasil
- Seja direto, conciso e use dados reais do contexto financeiro
- Use emojis para tornar as respostas mais visuais
- Formate valores como moeda brasileira (R$)
- Quando o usuário pedir para registrar/criar transações, informe que essa funcionalidade deve ser feita pelo painel web
- Se perguntarem algo fora de finanças, redirecione educadamente
- Quando fizer análises, cite números reais do contexto
- Para WhatsApp: use formatação simples (*negrito*, _itálico_), sem markdown complexo
- Limite respostas a no máximo 500 palavras

CONTEXTO FINANCEIRO ATUAL:
${contexto.resumo}`,
      },
      { role: 'user', content: mensagem },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  })

  return response.choices[0]?.message?.content || 'Desculpe, não consegui processar sua pergunta.'
}

// ============================================================
// INSIGHTS: Gerar insights inteligentes para o dashboard
// ============================================================
export async function gerarInsights(
  config: { apiKey: string; model: string }
): Promise<{ insights: { tipo: 'info' | 'warning' | 'success' | 'danger'; titulo: string; descricao: string; valor?: string }[] }> {
  const openai = createOpenAI(config.apiKey)
  const contexto = await coletarContextoFinanceiro()

  const response = await openai.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: `Você é um analista financeiro. Analise os dados e gere insights acionáveis.

Retorne APENAS um JSON com a estrutura:
{
  "insights": [
    {
      "tipo": "info" | "warning" | "success" | "danger",
      "titulo": "título curto (max 60 chars)",
      "descricao": "explicação em 1-2 frases com dados concretos",
      "valor": "valor relevante formatado (opcional)"
    }
  ]
}

Gere entre 3 e 6 insights. Priorize:
- Alertas de gastos excessivos vs mês anterior
- Contas atrasadas ou prestes a vencer
- Categorias com crescimento anormal
- Oportunidades de economia
- Saúde financeira geral
- Franquias com desempenho inferior/superior
- Orçamentos estourados
- Cartões com limite alto usado

Use APENAS dados reais do contexto, nunca invente números.`,
      },
      { role: 'user', content: contexto.resumo },
    ],
    temperature: 0.2,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  })

  try {
    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    return { insights: parsed.insights || [] }
  } catch {
    return { insights: [] }
  }
}

// ============================================================
// ANÁLISE PREDITIVA: Previsões e alertas automáticos
// ============================================================
export async function analisePreditiva(
  config: { apiKey: string; model: string }
): Promise<{ previsoes: { tipo: string; titulo: string; descricao: string; probabilidade: number; impacto: string; acao_sugerida: string }[] }> {
  const openai = createOpenAI(config.apiKey)
  const contexto = await coletarContextoFinanceiro()

  const response = await openai.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: `Você é um analista financeiro preditivo. Analise tendências dos últimos 3 meses e faça previsões.

Retorne APENAS JSON:
{
  "previsoes": [
    {
      "tipo": "fluxo_caixa" | "gasto_excessivo" | "sazonalidade" | "oportunidade" | "risco",
      "titulo": "título curto",
      "descricao": "explicação detalhada com dados",
      "probabilidade": 0.0 a 1.0,
      "impacto": "valor estimado em R$",
      "acao_sugerida": "o que o usuário deve fazer"
    }
  ]
}

Gere 3-5 previsões baseadas nas tendências reais. Considere:
- Projeção de saldo para os próximos 30 dias
- Gastos que estão crescendo mês a mês
- Receitas em queda
- Padrões sazonais
- Riscos de ficar negativo`,
      },
      { role: 'user', content: contexto.resumo },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  })

  try {
    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    return { previsoes: parsed.previsoes || [] }
  } catch {
    return { previsoes: [] }
  }
}

// ============================================================
// RELATÓRIO MENSAL: Gerar relatório narrado em linguagem natural
// ============================================================
export async function gerarRelatorio(
  config: { apiKey: string; model: string },
  formato: 'completo' | 'resumido' | 'whatsapp' = 'completo'
): Promise<string> {
  const openai = createOpenAI(config.apiKey)
  const contexto = await coletarContextoFinanceiro()

  const instrucoes = formato === 'whatsapp'
    ? 'Gere um resumo financeiro para WhatsApp. Use formatação WhatsApp (*negrito*, _itálico_). Máximo 300 palavras. Inclua emojis.'
    : formato === 'resumido'
    ? 'Gere um resumo executivo financeiro em 3-5 parágrafos. Inclua destaques, alertas e recomendações.'
    : 'Gere um relatório financeiro completo e detalhado. Inclua: resumo executivo, análise de receitas/despesas, comparativo mensal, análise por categoria, análise por empresa/franquia, alertas, recomendações e conclusão.'

  const response = await openai.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: `Você é um consultor financeiro gerando um relatório profissional.

${instrucoes}

Use APENAS dados reais do contexto. Nunca invente números.
Formate valores como moeda brasileira (R$).
Responda em português do Brasil.`,
      },
      { role: 'user', content: contexto.resumo },
    ],
    temperature: 0.3,
    max_tokens: formato === 'whatsapp' ? 1000 : 3000,
  })

  return response.choices[0]?.message?.content || 'Não foi possível gerar o relatório.'
}

// ============================================================
// ORÇAMENTO INTELIGENTE: Sugerir limites por categoria
// ============================================================
export async function sugerirOrcamentos(
  config: { apiKey: string; model: string }
): Promise<{ sugestoes: { categoria: string; categoria_id: string; valor_sugerido: number; justificativa: string }[] }> {
  const openai = createOpenAI(config.apiKey)
  const contexto = await coletarContextoFinanceiro()

  const categList = contexto.dados.categorias
    .filter(c => c.tipo === 'despesa')
    .map(c => `${c.nome} (id: ${c.id})`)
    .join(', ')

  const response = await openai.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: `Você é um planejador financeiro. Sugira orçamentos mensais por categoria.

Categorias de despesa disponíveis: ${categList}

Retorne APENAS JSON:
{
  "sugestoes": [
    {
      "categoria": "nome da categoria",
      "categoria_id": "id UUID",
      "valor_sugerido": 1500.00,
      "justificativa": "baseado no gasto médio de X dos últimos 3 meses + margem de 10%"
    }
  ]
}

Base suas sugestões nos gastos reais dos últimos 3 meses. Aplique margem de segurança de 5-15%. Considere sazonalidade.`,
      },
      { role: 'user', content: contexto.resumo },
    ],
    temperature: 0.2,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  })

  try {
    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    return { sugestoes: parsed.sugestoes || [] }
  } catch {
    return { sugestoes: [] }
  }
}

// ============================================================
// DETECÇÃO DE DUPLICATAS: Encontrar transações possivelmente duplicadas
// ============================================================
export async function detectarDuplicatas(): Promise<{ grupos: { descricao: string; ids: string[]; valor: number; datas: string[] }[] }> {
  const supabase = createServerSupabase()
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: transacoes } = await supabase
    .from('_financeiro_transacoes')
    .select('id, descricao, valor, data_vencimento, tipo, status')
    .gte('data_vencimento', trintaDiasAtras)
    .neq('status', 'cancelado')
    .order('data_vencimento', { ascending: false }) as { data: { id: string; descricao: string; valor: number; data_vencimento: string; tipo: string; status: string }[] | null }

  if (!transacoes || transacoes.length === 0) return { grupos: [] }

  // Normalizar descrição para comparação
  const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim()

  // Agrupar por valor + descrição similar
  const grupos: Map<string, { descricao: string; ids: string[]; valor: number; datas: string[] }> = new Map()

  for (let i = 0; i < transacoes.length; i++) {
    const t1 = transacoes[i]
    const norm1 = normalizar(t1.descricao)

    for (let j = i + 1; j < transacoes.length; j++) {
      const t2 = transacoes[j]
      if (Math.abs(Number(t1.valor) - Number(t2.valor)) > 0.01) continue // valor diferente
      if (t1.tipo !== t2.tipo) continue // tipo diferente

      const norm2 = normalizar(t2.descricao)

      // Verificar similaridade
      const similar = norm1 === norm2 ||
        norm1.includes(norm2) || norm2.includes(norm1) ||
        calcSimilaridade(norm1, norm2) >= 0.7

      if (!similar) continue

      // Verificar se datas são próximas (máximo 5 dias)
      const diff = Math.abs(new Date(t1.data_vencimento).getTime() - new Date(t2.data_vencimento).getTime()) / (1000 * 60 * 60 * 24)
      if (diff > 5) continue

      const key = `${norm1}_${Number(t1.valor).toFixed(2)}`
      if (!grupos.has(key)) {
        grupos.set(key, { descricao: t1.descricao, ids: [t1.id], valor: Number(t1.valor), datas: [t1.data_vencimento] })
      }
      const grupo = grupos.get(key)!
      if (!grupo.ids.includes(t2.id)) {
        grupo.ids.push(t2.id)
        grupo.datas.push(t2.data_vencimento)
      }
    }
  }

  return { grupos: Array.from(grupos.values()).filter(g => g.ids.length > 1) }
}

function calcSimilaridade(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let inter = 0
  for (const w of wordsA) if (wordsB.has(w)) inter++
  return inter / new Set([...wordsA, ...wordsB]).size
}

// ============================================================
// COBRANÇA INTELIGENTE: Gerar mensagem personalizada
// ============================================================
export async function gerarMensagemCobranca(
  config: { apiKey: string; model: string },
  cobranca: { descricao: string; valor: number; data_vencimento: string; nome_contato: string; dias_atraso: number; tentativas: number }
): Promise<string> {
  const openai = createOpenAI(config.apiKey)

  const tom = cobranca.dias_atraso <= 0
    ? 'amigável e lembrete'
    : cobranca.dias_atraso <= 7
    ? 'educado mas firme'
    : cobranca.dias_atraso <= 30
    ? 'firme e profissional'
    : 'sério e urgente'

  const response = await openai.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: `Gere uma mensagem de cobrança para WhatsApp.

Tom: ${tom}
Tentativa número: ${cobranca.tentativas + 1}

Regras:
- Formatação WhatsApp (*negrito*, _itálico_)
- Máximo 150 palavras
- Seja profissional e respeitoso
- Inclua valor e data
- Se for a 3ª+ tentativa, mencione consequências sutilmente
- Use emojis moderadamente
- Assinatura: _Farol Finance - Gestão Financeira_`,
      },
      {
        role: 'user',
        content: `Nome: ${cobranca.nome_contato}\nDescrição: ${cobranca.descricao}\nValor: R$${cobranca.valor.toFixed(2)}\nVencimento: ${new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR')}\nDias de atraso: ${cobranca.dias_atraso}\nTentativas anteriores: ${cobranca.tentativas}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 500,
  })

  return response.choices[0]?.message?.content || ''
}

// ============================================================
// AUTO-DESCRIÇÃO OFX: Melhorar descrições bancárias ruins
// ============================================================
export async function melhorarDescricoesOFX(
  descricoes: string[],
  config: { apiKey: string; model: string }
): Promise<Map<string, string>> {
  const openai = createOpenAI(config.apiKey)
  const resultado = new Map<string, string>()

  if (descricoes.length === 0) return resultado

  const lotes: string[][] = []
  for (let i = 0; i < descricoes.length; i += 40) {
    lotes.push(descricoes.slice(i, i + 40))
  }

  for (const lote of lotes) {
    const listaStr = lote.map((d, i) => `${i + 1}. "${d}"`).join('\n')

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em extratos bancários brasileiros. 
Converta descrições bancárias crípticas em descrições legíveis.

Exemplos:
- "PAG*JoseMarcos" → "Pagamento PIX - José Marcos"
- "PGTO DEBITO VISA 12345" → "Pagamento no Débito Visa"
- "REC TED 001 MARIA" → "Transferência Recebida TED - Maria"
- "RSHOP*IFOO" → "iFood"
- "PAG*UBER" → "Uber"
- "MP *MERCADOPA" → "Mercado Pago"

Retorne JSON:
{
  "descricoes": [
    {"index": 1, "original": "...", "melhorada": "..."}
  ]
}

Se a descrição já é clara, mantenha como está.`,
        },
        { role: 'user', content: `Melhore estas descrições de extrato:\n${listaStr}` },
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    })

    try {
      const content = response.choices[0]?.message?.content || '{}'
      const parsed = JSON.parse(content)
      const items = parsed.descricoes || parsed.results || []
      for (const item of items) {
        if (item.index >= 1 && item.index <= lote.length && item.melhorada) {
          resultado.set(lote[item.index - 1], item.melhorada)
        }
      }
    } catch { /* ignore parse errors */ }
  }

  return resultado
}

// ============================================================
// SCORE DE SAÚDE FINANCEIRA
// ============================================================
export async function calcularScoreSaude(
  config: { apiKey: string; model: string }
): Promise<{ score: number; nivel: string; fatores: { nome: string; score: number; peso: number; detalhe: string }[]; recomendacoes: string[] }> {
  const openai = createOpenAI(config.apiKey)
  const contexto = await coletarContextoFinanceiro()

  const response = await openai.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: `Calcule um score de saúde financeira de 0 a 100.

Retorne APENAS JSON:
{
  "score": 75,
  "nivel": "Bom" (Crítico <30, Ruim 30-49, Regular 50-69, Bom 70-84, Excelente 85+),
  "fatores": [
    {"nome": "Margem Líquida", "score": 80, "peso": 25, "detalhe": "receitas 30% acima das despesas"},
    {"nome": "Endividamento", "score": 60, "peso": 20, "detalhe": "cartões usando 45% do limite"},
    {"nome": "Pontualidade", "score": 90, "peso": 20, "detalhe": "2 contas atrasadas"},
    {"nome": "Reserva", "score": 70, "peso": 15, "detalhe": "saldo cobre 2 meses de despesas"},
    {"nome": "Controle", "score": 85, "peso": 10, "detalhe": "boa categorização"},
    {"nome": "Tendência", "score": 65, "peso": 10, "detalhe": "despesas crescendo 15%"}
  ],
  "recomendacoes": ["Pague os 2 boletos atrasados...", "Reduza 10% em alimentação..."]
}

Base TUDO em dados reais.`,
      },
      { role: 'user', content: contexto.resumo },
    ],
    temperature: 0.2,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  })

  try {
    const content = response.choices[0]?.message?.content || '{}'
    return JSON.parse(content)
  } catch {
    return { score: 0, nivel: 'Erro', fatores: [], recomendacoes: [] }
  }
}
