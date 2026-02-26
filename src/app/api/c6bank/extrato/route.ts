import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import {
  c6ExtratoConsultar,
  c6ContaConsultar,
  c6DDAConsultar,
  c6DDADecodificar,
  buildC6Config,
} from '@/lib/c6bank'

export const dynamic = 'force-dynamic'

async function getC6Config() {
  const supabase = createServerSupabase()
  const { data } = await supabase
    .from('_financeiro_integracoes')
    .select('*')
    .eq('provedor', 'c6bank')
    .eq('ativa', true)
    .single()
  if (!data) throw new Error('C6 Bank não configurado')
  return buildC6Config(data)
}

// GET - Extrato, Saldo ou DDA
export async function GET(request: Request) {
  try {
    const config = await getC6Config()
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') || 'extrato'

    // Consultar saldo da conta
    if (tipo === 'saldo') {
      const data = await c6ContaConsultar(config)
      return NextResponse.json(data)
    }

    // Consultar DDA (boletos pendentes)
    if (tipo === 'dda') {
      const data = await c6DDAConsultar(config)
      return NextResponse.json(data)
    }

    // Extrato bancário
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0]
    const page = parseInt(searchParams.get('page') || '1')
    const data = await c6ExtratoConsultar(config, startDate, endDate, page)
    return NextResponse.json(data)
  } catch (error) {
    console.error('C6 Extrato GET error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao consultar' }, { status: 500 })
  }
}

// POST - Decodificar código de barras (DDA) ou importar extrato
export async function POST(request: Request) {
  try {
    const config = await getC6Config()
    const body = await request.json()
    const { action } = body

    // Decodificar código de barras
    if (action === 'decodificar') {
      const data = await c6DDADecodificar(config, body.items)
      return NextResponse.json(data)
    }

    // Importar extrato para o sistema
    if (action === 'importar') {
      const startDate = body.start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
      const endDate = body.end_date || new Date().toISOString().split('T')[0]
      const extrato = await c6ExtratoConsultar(config, startDate, endDate)

      const supabase = createServerSupabase()
      const entries = Array.isArray(extrato) ? extrato : extrato.data || extrato.entries || []
      let imported = 0
      let skipped = 0

      for (const entry of entries) {
        const valor = Math.abs(parseFloat(entry.amount || entry.valor || 0))
        if (valor === 0) { skipped++; continue }

        const tipo = parseFloat(entry.amount || entry.valor || 0) >= 0 ? 'receita' : 'despesa'
        const idExterno = `c6-${entry.id || entry.transaction_id || Date.now()}-${imported}`

        // Verificar duplicata
        const { data: existing } = await supabase
          .from('_financeiro_transacoes')
          .select('id')
          .eq('id_externo', idExterno)
          .single()

        if (existing) { skipped++; continue }

        await supabase.from('_financeiro_transacoes').insert({
          tipo,
          descricao: entry.description || entry.descricao || 'Movimentação C6 Bank',
          valor,
          data_vencimento: entry.date || entry.data || startDate,
          data_pagamento: entry.date || entry.data || startDate,
          status: 'pago',
          conta_bancaria_id: body.conta_bancaria_id || null,
          origem_integracao: 'c6bank',
          id_externo: idExterno,
          is_pessoal: false,
        })
        imported++
      }

      return NextResponse.json({
        success: true,
        imported,
        skipped,
        total: entries.length,
        message: `${imported} transações importadas, ${skipped} ignoradas`,
      })
    }

    return NextResponse.json({ error: 'Action inválida' }, { status: 400 })
  } catch (error) {
    console.error('C6 Extrato POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 500 })
  }
}
