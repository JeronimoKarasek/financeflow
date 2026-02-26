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

    const rawValor = cols[vI]?.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
    const valor = parseFloat(rawValor)
    if (isNaN(valor)) continue

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

    rows.push({
      data,
      descricao: cols[dsI] || `Transação ${i}`,
      valor: Math.abs(valor),
      tipo,
      franquia: franquiaIdx >= 0 ? cols[franquiaIdx]?.trim() || '' : '',
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

    // Preparar transações para inserção
    const transacoes = parsed.map(row => ({
      tipo: row.tipo || 'despesa',
      descricao: row.descricao,
      valor: row.valor,
      data_vencimento: row.data,
      data_pagamento: row.data,
      status: 'pago' as const,
      conta_bancaria_id: targetType === 'conta' ? targetId : null,
      cartao_credito_id: targetType === 'cartao' ? targetId : null,
      franquia_id: row.franquia ? (franquiaMap[row.franquia.toLowerCase().trim()] || null) : null,
      is_pessoal: false,
      usuario_id: usuarioId || null,
      origem_integracao: 'importacao',
      observacoes: `Importado de: ${file.name}`,
    }))

    const { data, error } = await supabase
      .from('_financeiro_transacoes')
      .insert(transacoes)
      .select()

    if (error) throw error

    // Se importou para conta bancária, atualizar saldo
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

    // Se importou para cartão de crédito, atualizar limite usado
    if (targetType === 'cartao') {
      const totalGastos = parsed.filter(r => r.tipo === 'despesa').reduce((s, r) => s + r.valor, 0)
      
      const { data: cartao } = await supabase
        .from('_financeiro_cartoes_credito')
        .select('limite_usado')
        .eq('id', targetId)
        .single()

      if (cartao) {
        await supabase
          .from('_financeiro_cartoes_credito')
          .update({ limite_usado: Number(cartao.limite_usado) + totalGastos })
          .eq('id', targetId)
      }
    }

    return NextResponse.json({
      success: true,
      importadas: data?.length || 0,
      resumo: {
        total: parsed.length,
        receitas: parsed.filter(r => r.tipo === 'receita').length,
        despesas: parsed.filter(r => r.tipo === 'despesa').length,
        valor_receitas: parsed.filter(r => r.tipo === 'receita').reduce((s, r) => s + r.valor, 0),
        valor_despesas: parsed.filter(r => r.tipo === 'despesa').reduce((s, r) => s + r.valor, 0),
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Importação error:', error)
    return NextResponse.json({ error: 'Erro ao importar arquivo' }, { status: 500 })
  }
}
