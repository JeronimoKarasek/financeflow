import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import {
  c6PixCriarCobranca,
  c6PixConsultarCobranca,
  c6PixListarCobrancas,
  c6PixAtualizarCobranca,
  c6PixConfigWebhook,
  c6PixConsultarWebhook,
  c6PixDeletarWebhook,
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

// GET - Listar cobranças PIX ou consultar específica
export async function GET(request: Request) {
  try {
    const config = await getC6Config()
    const { searchParams } = new URL(request.url)
    const txid = searchParams.get('txid')
    const action = searchParams.get('action')

    // Consultar webhook PIX
    if (action === 'webhook') {
      const data = await c6PixConsultarWebhook(config)
      return NextResponse.json(data)
    }

    // Consultar cobrança específica
    if (txid) {
      const data = await c6PixConsultarCobranca(config, txid)
      return NextResponse.json(data)
    }

    // Listar cobranças por período
    const inicio = searchParams.get('inicio') || new Date(Date.now() - 30 * 86400000).toISOString()
    const fim = searchParams.get('fim') || new Date().toISOString()
    const data = await c6PixListarCobrancas(config, inicio, fim)
    return NextResponse.json(data)
  } catch (error) {
    console.error('C6 PIX GET error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro PIX' }, { status: 500 })
  }
}

// POST - Criar cobrança PIX ou configurar webhook
export async function POST(request: Request) {
  try {
    const config = await getC6Config()
    const body = await request.json()
    const { action } = body

    // Configurar webhook PIX
    if (action === 'webhook') {
      const data = await c6PixConfigWebhook(config, body.webhookUrl)
      return NextResponse.json(data)
    }

    // Deletar webhook PIX
    if (action === 'deleteWebhook') {
      const data = await c6PixDeletarWebhook(config)
      return NextResponse.json(data)
    }

    // Criar cobrança PIX imediata
    const data = await c6PixCriarCobranca(config, {
      valor: body.valor,
      cpf: body.cpf,
      nome: body.nome,
      descricao: body.descricao,
      expiracao: body.expiracao,
    })

    // Registrar no banco como transação se solicitado
    if (body.registrar_transacao) {
      const supabase = createServerSupabase()
      await supabase.from('_financeiro_transacoes').insert({
        tipo: 'receita',
        descricao: body.descricao || `PIX C6 - ${data.txid || ''}`,
        valor: parseFloat(body.valor),
        data_vencimento: new Date().toISOString().split('T')[0],
        status: 'pendente',
        conta_bancaria_id: body.conta_bancaria_id || null,
        origem_integracao: 'c6bank',
        id_externo: data.txid || null,
        is_pessoal: false,
      })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('C6 PIX POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro PIX' }, { status: 500 })
  }
}

// PATCH - Atualizar cobrança PIX
export async function PATCH(request: Request) {
  try {
    const config = await getC6Config()
    const body = await request.json()
    const { txid, ...dados } = body
    if (!txid) return NextResponse.json({ error: 'txid obrigatório' }, { status: 400 })
    const data = await c6PixAtualizarCobranca(config, txid, dados)
    return NextResponse.json(data)
  } catch (error) {
    console.error('C6 PIX PATCH error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro PIX' }, { status: 500 })
  }
}
