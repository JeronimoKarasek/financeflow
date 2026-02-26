import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import {
  c6BoletoEmitir,
  c6BoletoConsultar,
  c6BoletoPDF,
  c6BoletoCancelar,
  c6BoletoAlterar,
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

// GET - Consultar boleto específico ou PDF
export async function GET(request: Request) {
  try {
    const config = await getC6Config()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const action = searchParams.get('action')

    if (!id) {
      return NextResponse.json({ error: 'ID do boleto obrigatório' }, { status: 400 })
    }

    if (action === 'pdf') {
      const data = await c6BoletoPDF(config, id)
      return NextResponse.json(data)
    }

    const data = await c6BoletoConsultar(config, id)
    return NextResponse.json(data)
  } catch (error) {
    console.error('C6 Boleto GET error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro Boleto' }, { status: 500 })
  }
}

// POST - Emitir novo boleto
export async function POST(request: Request) {
  try {
    const config = await getC6Config()
    const body = await request.json()

    if (!body.valor || !body.vencimento || !body.pagador?.nome || !body.pagador?.cpf_cnpj) {
      return NextResponse.json({ error: 'Campos obrigatórios: valor, vencimento, pagador.nome, pagador.cpf_cnpj' }, { status: 400 })
    }

    const data = await c6BoletoEmitir(config, {
      valor: parseFloat(body.valor),
      vencimento: body.vencimento,
      pagador: body.pagador,
      referencia: body.referencia,
      instrucoes: body.instrucoes,
      juros: body.juros,
      multa: body.multa,
      desconto: body.desconto,
    })

    // Registrar como cobrança no sistema
    if (body.registrar_cobranca) {
      const supabase = createServerSupabase()
      await supabase.from('_financeiro_cobrancas').insert({
        tipo: 'receber',
        descricao: `Boleto C6 - ${body.pagador.nome}`,
        valor: parseFloat(body.valor),
        data_vencimento: body.vencimento,
        status: 'pendente',
        nome_contato: body.pagador.nome,
        cpf_cnpj_contato: body.pagador.cpf_cnpj,
        email_contato: body.pagador.email || null,
        gateway: 'c6bank',
        id_externo_gateway: data.id || null,
        is_pessoal: false,
      })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('C6 Boleto POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro Boleto' }, { status: 500 })
  }
}

// PUT - Alterar ou cancelar boleto
export async function PUT(request: Request) {
  try {
    const config = await getC6Config()
    const body = await request.json()
    const { id, action, ...updateData } = body

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    if (action === 'cancel') {
      const data = await c6BoletoCancelar(config, id)
      return NextResponse.json(data)
    }

    const data = await c6BoletoAlterar(config, id, updateData)
    return NextResponse.json(data)
  } catch (error) {
    console.error('C6 Boleto PUT error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro Boleto' }, { status: 500 })
  }
}
