import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface ImportedRow {
  data: string
  descricao: string
  valor: number
  tipo?: 'receita' | 'despesa'
  categoria?: string
  franquia?: string
  parcela?: number   // nº da parcela atual (ex: 2)
  prazo?: number     // total de parcelas (ex: 10)
  fixo?: boolean     // transação fixa mensal
}

// Calcula a data de vencimento da fatura do cartão para uma compra
function calcularVencimentoFatura(dataCompra: string, diaFechamento: number, diaVencimento: number): string {
  const compra = new Date(dataCompra + 'T12:00:00')
  const diaCompra = compra.getDate()
  let mesFechamento = compra.getMonth()
  let anoFechamento = compra.getFullYear()

  // Se a compra foi depois do dia de fechamento, vai para o ciclo do mês seguinte
  if (diaCompra > diaFechamento) {
    mesFechamento++
    if (mesFechamento > 11) { mesFechamento = 0; anoFechamento++ }
  }

  // O vencimento depende se dia_vencimento vem antes ou depois do fechamento
  let mesVenc = mesFechamento
  let anoVenc = anoFechamento

  if (diaVencimento <= diaFechamento) {
    // Vencimento no mês seguinte ao fechamento (ex: fecha dia 25, vence dia 10)
    mesVenc++
    if (mesVenc > 11) { mesVenc = 0; anoVenc++ }
  }

  const maxDia = new Date(anoVenc, mesVenc + 1, 0).getDate()
  const dia = Math.min(diaVencimento, maxDia)

  return `${anoVenc}-${String(mesVenc + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// Adiciona N meses a uma data no formato YYYY-MM-DD
function adicionarMeses(dataStr: string, meses: number): string {
  const d = new Date(dataStr + 'T12:00:00')
  const dia = d.getDate()
  d.setMonth(d.getMonth() + meses)
  // Corrigir overflow de dia (ex: 31 jan + 1 mês = 28 fev)
  if (d.getDate() !== dia) {
    d.setDate(0) // último dia do mês anterior
  }
  return d.toISOString().split('T')[0]
}

// ============ GET: Histórico de importações ============
export async function GET() {
  try {
    const supabase = createServerSupabase()

    // Buscar transações agrupadas por arquivo de importação
    const { data, error } = await supabase
      .from('_financeiro_transacoes')
      .select('id, tipo, valor, descricao, observacoes, created_at, data_vencimento, franquia_id, conta_bancaria_id, cartao_credito_id')
      .eq('origem_integracao', 'importacao')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Agrupar por arquivo (observacoes contém "Importado de: nome_arquivo")
    const groups: Record<string, {
      arquivo: string
      data_importacao: string
      total: number
      receitas: number
      despesas: number
      valor_receitas: number
      valor_despesas: number
      ids: string[]
    }> = {}

    for (const t of (data || [])) {
      const arq = t.observacoes?.replace('Importado de: ', '') || 'Desconhecido'
      // Agrupar por arquivo + data de criação (mesmo dia)
      const createdDate = t.created_at?.split('T')[0] || ''
      const key = `${arq}__${createdDate}`

      if (!groups[key]) {
        groups[key] = {
          arquivo: arq,
          data_importacao: t.created_at,
          total: 0,
          receitas: 0,
          despesas: 0,
          valor_receitas: 0,
          valor_despesas: 0,
          ids: [],
        }
      }
      groups[key].total++
      groups[key].ids.push(t.id)
      if (t.tipo === 'receita') {
        groups[key].receitas++
        groups[key].valor_receitas += Number(t.valor)
      } else {
        groups[key].despesas++
        groups[key].valor_despesas += Number(t.valor)
      }
    }

    const historico = Object.values(groups).sort((a, b) =>
      new Date(b.data_importacao).getTime() - new Date(a.data_importacao).getTime()
    )

    return NextResponse.json(historico)
  } catch (error) {
    console.error('Importação GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 })
  }
}

// ============ DELETE: Excluir importação inteira ============
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { ids } = body as { ids: string[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs são obrigatórios' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    // Buscar saldo para reverter (transações pagas)
    const { data: transacoes } = await supabase
      .from('_financeiro_transacoes')
      .select('tipo, valor, status, conta_bancaria_id')
      .in('id', ids)
      .eq('status', 'pago')

    // Reverter saldos das contas afetadas
    if (transacoes && transacoes.length > 0) {
      const contaAjustes: Record<string, number> = {}
      for (const t of transacoes) {
        if (!t.conta_bancaria_id) continue
        if (!contaAjustes[t.conta_bancaria_id]) contaAjustes[t.conta_bancaria_id] = 0
        const val = Number(t.valor)
        contaAjustes[t.conta_bancaria_id] += t.tipo === 'receita' ? -val : val
      }

      for (const [contaId, ajuste] of Object.entries(contaAjustes)) {
        const { data: conta } = await supabase
          .from('_financeiro_contas_bancarias')
          .select('saldo_atual')
          .eq('id', contaId)
          .single()
        if (conta) {
          await supabase
            .from('_financeiro_contas_bancarias')
            .update({ saldo_atual: Number(conta.saldo_atual) + ajuste })
            .eq('id', contaId)
        }
      }
    }

    // Deletar todas as transações
    const { error } = await supabase
      .from('_financeiro_transacoes')
      .delete()
      .in('id', ids)

    if (error) throw error

    return NextResponse.json({ success: true, deletadas: ids.length })
  } catch (error) {
    console.error('Importação DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao excluir importação' }, { status: 500 })
  }
}

// Parser inteligente de valores monetários (suporta BR e US)
function parseValorBR(raw: string): number {
  let s = raw.replace(/[R$\s]/g, '').trim()
  if (!s) return NaN

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma > -1 && lastDot > -1) {
    // Ambos existem: o ÚLTIMO é o separador decimal
    if (lastComma > lastDot) {
      // BR: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // US: 1,234.56
      s = s.replace(/,/g, '')
    }
  } else if (lastComma > -1) {
    // Só vírgula: se tem 1-2 dígitos depois, é decimal
    const afterComma = s.substring(lastComma + 1)
    if (afterComma.length <= 2) {
      s = s.replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (lastDot > -1) {
    // Só ponto: se tem 1-2 dígitos depois, é decimal; senão milhar
    const afterDot = s.substring(lastDot + 1)
    if (afterDot.length <= 2) {
      // Mantém como está (decimal com ponto)
    } else {
      s = s.replace(/\./g, '')
    }
  }

  return parseFloat(s)
}

function parseCSV(text: string): ImportedRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  // Detectar separador (vírgula, ponto-e-vírgula ou tab)
  const header = lines[0].toLowerCase()
  const separator = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ','

  const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

  // Mapear colunas: tentar várias nomenclaturas comuns
  const dataIdx = headers.findIndex(h => ['data', 'date', 'dt', 'data_lancamento', 'data lancamento', 'data transacao', 'data_transacao'].includes(h))
  const descIdx = headers.findIndex(h => ['descricao', 'descrição', 'description', 'desc', 'historico', 'histórico', 'lancamento', 'lançamento', 'memo', 'nome'].includes(h))
  const valorIdx = headers.findIndex(h => ['valor', 'value', 'amount', 'quantia', 'montante', 'vlr'].includes(h))
  const tipoIdx = headers.findIndex(h => ['tipo', 'type', 'natureza', 'credito_debito', 'crédito_débito', 'cd'].includes(h))
  const franquiaIdx = headers.findIndex(h => ['franquia', 'empresa', 'company', 'unidade', 'filial', 'loja'].includes(h))
  const categoriaIdx = headers.findIndex(h => ['categoria', 'category', 'cat', 'grupo', 'classificacao', 'classificação'].includes(h))
  const parcelaIdx = headers.findIndex(h => ['parcela', 'installment', 'parc', 'nº parcela', 'n parcela'].includes(h))
  const prazoIdx = headers.findIndex(h => ['prazo', 'total parcelas', 'total_parcelas', 'parcelas', 'installments', 'vezes', 'x'].includes(h))
  const fixoIdx = headers.findIndex(h => ['fixo', 'fixo/recorrente', 'recorrente', 'fixed', 'recurring', 'mensal'].includes(h))

  // Se não encontrou colunas essenciais, tentar fallback posicional (data, desc, valor)
  const dI = dataIdx >= 0 ? dataIdx : 0
  const dsI = descIdx >= 0 ? descIdx : 1
  const vI = valorIdx >= 0 ? valorIdx : 2

  const rows: ImportedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(separator).map(c => c.trim().replace(/^["']|["']$/g, ''))
    if (cols.length < 3) continue

    const valor = parseValorBR(cols[vI] || '')
    if (isNaN(valor) || valor === 0) continue

    let tipo: 'receita' | 'despesa' = valor >= 0 ? 'receita' : 'despesa'

    // Se tem coluna de tipo explícito
    if (tipoIdx >= 0) {
      const t = cols[tipoIdx]?.toLowerCase()
      if (t === 'c' || t === 'crédito' || t === 'credito' || t === 'credit' || t === 'receita') tipo = 'receita'
      if (t === 'd' || t === 'débito' || t === 'debito' || t === 'debit' || t === 'despesa') tipo = 'despesa'
    }

    const rawDate = cols[dI]
    let data = ''
    // Tentar formatos de data: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, mm/dd/yyyy
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(rawDate)) {
      const parts = rawDate.split(/[\/\-]/)
      data = `${parts[2]}-${parts[1]}-${parts[0]}`
    } else if (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(rawDate)) {
      data = rawDate.substring(0, 10)
    } else {
      data = new Date().toISOString().split('T')[0]
    }

    // Detectar parcela e prazo (colunas separadas)
    let parcela: number | undefined = undefined
    let prazo: number | undefined = undefined
    if (parcelaIdx >= 0) {
      const p = parseInt(cols[parcelaIdx]?.trim() || '')
      if (!isNaN(p) && p > 0) parcela = p
    }
    if (prazoIdx >= 0) {
      const p = parseInt(cols[prazoIdx]?.trim() || '')
      if (!isNaN(p) && p > 0) prazo = p
    }

    // Detectar fixo
    let fixo = false
    if (fixoIdx >= 0) {
      const f = cols[fixoIdx]?.trim().toLowerCase() || ''
      fixo = ['sim', 'yes', 's', 'y', '1', 'true', 'x'].includes(f)
    }

    rows.push({
      data,
      descricao: cols[dsI] || `Transação ${i}`,
      valor: Math.abs(valor),
      tipo,
      franquia: franquiaIdx >= 0 ? cols[franquiaIdx]?.trim() || '' : '',
      categoria: categoriaIdx >= 0 ? cols[categoriaIdx]?.trim() || '' : '',
      parcela,
      prazo,
      fixo,
    })
  }

  return rows
}

function parseOFX(text: string): ImportedRow[] {
  const rows: ImportedRow[] = []
  // OFX é XML-like, extrair transações de <STMTTRN>
  const transRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match
  while ((match = transRegex.exec(text)) !== null) {
    const block = match[1]
    const getValue = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\\n]+)`, 'i'))
      return m ? m[1].trim() : ''
    }

    const dtposted = getValue('DTPOSTED') // YYYYMMDD ou YYYYMMDDHHmmss
    const trnamt = getValue('TRNAMT')
    const memo = getValue('MEMO') || getValue('NAME') || 'Transação importada'
    const trntype = getValue('TRNTYPE')

    const valor = parseFloat(trnamt?.replace(',', '.') || '0')
    if (isNaN(valor) || valor === 0) continue

    let data = new Date().toISOString().split('T')[0]
    if (dtposted && dtposted.length >= 8) {
      data = `${dtposted.substring(0, 4)}-${dtposted.substring(4, 6)}-${dtposted.substring(6, 8)}`
    }

    let tipo: 'receita' | 'despesa' = valor >= 0 ? 'receita' : 'despesa'
    if (trntype === 'DEBIT') tipo = 'despesa'
    if (trntype === 'CREDIT') tipo = 'receita'

    rows.push({ data, descricao: memo, valor: Math.abs(valor), tipo })
  }
  return rows
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const targetType = formData.get('target_type') as string // 'conta' ou 'cartao'
    const targetId = formData.get('target_id') as string
    const usuarioId = formData.get('usuario_id') as string || null

    if (!file || !targetType || !targetId) {
      return NextResponse.json({ error: 'Arquivo, tipo de destino e ID do destino são obrigatórios' }, { status: 400 })
    }

    const text = await file.text()
    const fileName = file.name.toLowerCase()

    let parsed: ImportedRow[]
    if (fileName.endsWith('.ofx') || fileName.endsWith('.qfx')) {
      parsed = parseOFX(text)
    } else {
      parsed = parseCSV(text)
    }

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'Nenhuma transação encontrada no arquivo. Verifique o formato.' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    // Buscar franquias para mapear pelo nome
    const { data: franquias } = await supabase
      .from('_financeiro_franquias')
      .select('id, nome')
      .eq('ativa', true)

    const franquiaMap: Record<string, string> = {}
    for (const f of (franquias || [])) {
      franquiaMap[f.nome.toLowerCase().trim()] = f.id
    }

    // Buscar categorias para mapear pelo nome
    const { data: categorias } = await supabase
      .from('_financeiro_categorias')
      .select('id, nome')

    const categoriaMap: Record<string, string> = {}
    for (const c of (categorias || [])) {
      categoriaMap[c.nome.toLowerCase().trim()] = c.id
    }

    // Buscar dados do cartão se for importação para cartão (para calcular vencimentos)
    let cartaoData: { dia_fechamento: number; dia_vencimento: number } | null = null
    if (targetType === 'cartao') {
      const { data: cartaoInfo } = await supabase
        .from('_financeiro_cartoes_credito')
        .select('dia_fechamento, dia_vencimento')
        .eq('id', targetId)
        .single()
      cartaoData = cartaoInfo || { dia_fechamento: 1, dia_vencimento: 10 }
    }

    // Preparar transações para inserção (incluindo parcelas geradas)
    const transacoes: Record<string, unknown>[] = []
    let parcelasGeradas = 0

    for (const row of parsed) {
      const franquiaId = row.franquia ? (franquiaMap[row.franquia.toLowerCase().trim()] || null) : null
      const categoriaId = row.categoria ? (categoriaMap[row.categoria.toLowerCase().trim()] || null) : null
      const isCartao = targetType === 'cartao'

      // Calcular data de vencimento base
      let dataVencimento = row.data
      if (isCartao && cartaoData) {
        dataVencimento = calcularVencimentoFatura(row.data, cartaoData.dia_fechamento, cartaoData.dia_vencimento)
      }

      // Verificar se tem parcela e prazo
      const parcelaAtual = row.parcela || null
      const parcelaTotal = row.prazo || null
      const temParcela = parcelaAtual && parcelaTotal && parcelaTotal > 0
      const grupoParcela = temParcela ? crypto.randomUUID() : null

      // Transação base (a parcela atual ou transação normal)
      const baseTransaction = {
        tipo: row.tipo || 'despesa',
        descricao: row.descricao + (parcelaAtual ? ` (${parcelaAtual}/${parcelaTotal})` : ''),
        valor: row.valor,
        data_vencimento: dataVencimento,
        data_pagamento: isCartao ? null : row.data,
        status: isCartao ? 'pendente' as const : 'pago' as const,
        conta_bancaria_id: targetType === 'conta' ? targetId : null,
        cartao_credito_id: isCartao ? targetId : null,
        categoria_id: categoriaId,
        franquia_id: franquiaId,
        is_pessoal: false,
        usuario_id: usuarioId || null,
        origem_integracao: 'importacao',
        observacoes: `Importado de: ${file.name}`,
        recorrente: row.fixo || false,
        recorrencia_tipo: row.fixo ? 'mensal' : null,
        parcela_atual: parcelaAtual,
        parcela_total: parcelaTotal,
        grupo_parcela_id: grupoParcela,
      }

      transacoes.push(baseTransaction)

      // Se tem parcelas, gerar as restantes (parcela X+1 até Y)
      if (temParcela && parcelaAtual && parcelaTotal && parcelaTotal > parcelaAtual) {
        const restantes = parcelaTotal - parcelaAtual
        for (let p = 1; p <= restantes; p++) {
          const numParcela = parcelaAtual + p
          const dataParc = adicionarMeses(dataVencimento, p)
          transacoes.push({
            ...baseTransaction,
            descricao: row.descricao + ` (${numParcela}/${parcelaTotal})`,
            data_vencimento: dataParc,
            data_pagamento: null,
            status: 'pendente',
            parcela_atual: numParcela,
          })
          parcelasGeradas++
        }
      }
    }

    const { data, error } = await supabase
      .from('_financeiro_transacoes')
      .insert(transacoes)
      .select()

    if (error) throw error

    // Se importou para conta bancária, atualizar saldo (só transações com status 'pago')
    if (targetType === 'conta') {
      const { data: conta } = await supabase
        .from('_financeiro_contas_bancarias')
        .select('saldo_atual')
        .eq('id', targetId)
        .single()

      if (conta) {
        const totalReceitas = parsed.filter(r => r.tipo === 'receita').reduce((s, r) => s + r.valor, 0)
        const totalDespesas = parsed.filter(r => r.tipo === 'despesa').reduce((s, r) => s + r.valor, 0)
        const novoSaldo = Number(conta.saldo_atual) + totalReceitas - totalDespesas

        await supabase
          .from('_financeiro_contas_bancarias')
          .update({ saldo_atual: novoSaldo })
          .eq('id', targetId)
      }
    }

    // Se importou para cartão de crédito, recalcular limite usado a partir das transações pendentes
    if (targetType === 'cartao') {
      const { data: pendentesCartao } = await supabase
        .from('_financeiro_transacoes')
        .select('valor')
        .eq('cartao_credito_id', targetId)
        .eq('tipo', 'despesa')
        .in('status', ['pendente', 'atrasado'])

      const limiteUsadoReal = pendentesCartao?.reduce((s, t) => s + Number(t.valor), 0) || 0

      await supabase
        .from('_financeiro_cartoes_credito')
        .update({ limite_usado: limiteUsadoReal })
        .eq('id', targetId)
    }

    const totalFixas = transacoes.filter(t => t.recorrente === true).length

    return NextResponse.json({
      success: true,
      importadas: data?.length || 0,
      resumo: {
        total: transacoes.length,
        receitas: transacoes.filter(t => t.tipo === 'receita').length,
        despesas: transacoes.filter(t => t.tipo === 'despesa').length,
        valor_receitas: transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0),
        valor_despesas: transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0),
        parcelas_geradas: parcelasGeradas,
        transacoes_fixas: totalFixas,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Importação error:', error)
    return NextResponse.json({ error: 'Erro ao importar arquivo' }, { status: 500 })
  }
}
