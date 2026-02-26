import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import {
  c6CheckoutCriar,
  c6CheckoutConsultar,
  c6CheckoutCancelar,
  c6PayRecebiveis,
  c6PayTransacoes,
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

// GET - Consultar checkout, recebíveis ou transações C6 Pay
export async function GET(request: Request) {
  try {
    const config = await getC6Config()
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') || 'checkout'
    const id = searchParams.get('id')

    // Consultar checkout específico
    if (tipo === 'checkout' && id) {
      const data = await c6CheckoutConsultar(config, id)
      return NextResponse.json(data)
    }

    // Recebíveis C6 Pay
    if (tipo === 'recebiveis') {
      const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0]
      const page = parseInt(searchParams.get('page') || '1')
      const data = await c6PayRecebiveis(config, startDate, page)
      return NextResponse.json(data)
    }

    // Transações C6 Pay
    if (tipo === 'transacoes') {
      const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0]
      const page = parseInt(searchParams.get('page') || '1')
      const data = await c6PayTransacoes(config, startDate, page)
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Parâmetros insuficientes' }, { status: 400 })
  } catch (error) {
    console.error('C6 Checkout GET error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 500 })
  }
}

// POST - Criar checkout (link de pagamento)
export async function POST(request: Request) {
  try {
    const config = await getC6Config()
    const body = await request.json()

    if (!body.valor || !body.descricao || !body.pagador?.nome || !body.pagador?.cpf_cnpj || !body.pagador?.email) {
      return NextResponse.json({ error: 'Campos obrigatórios: valor, descricao, pagador (nome, cpf_cnpj, email)' }, { status: 400 })
    }

    const data = await c6CheckoutCriar(config, {
      valor: parseFloat(body.valor),
      descricao: body.descricao,
      referencia: body.referencia,
      pagador: body.pagador,
      redirectUrl: body.redirect_url,
    })

    // Registrar como cobrança
    if (body.registrar_cobranca) {
      const supabase = createServerSupabase()
      await supabase.from('_financeiro_cobrancas').insert({
        tipo: 'receber',
        descricao: `Checkout C6 - ${body.descricao}`,
        valor: parseFloat(body.valor),
        data_vencimento: new Date().toISOString().split('T')[0],
        status: 'pendente',
        nome_contato: body.pagador.nome,
        cpf_cnpj_contato: body.pagador.cpf_cnpj,
        email_contato: body.pagador.email,
        gateway: 'c6bank',
        link_pagamento: data.checkout_url || data.url || null,
        id_externo_gateway: data.id || null,
        is_pessoal: false,
      })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('C6 Checkout POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 500 })
  }
}

// PUT - Cancelar checkout
export async function PUT(request: Request) {
  try {
    const config = await getC6Config()
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    const data = await c6CheckoutCancelar(config, body.id)
    return NextResponse.json(data)
  } catch (error) {
    console.error('C6 Checkout PUT error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 500 })
  }
}
