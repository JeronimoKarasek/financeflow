import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import {
  c6WebhookRegistrar,
  c6WebhookListar,
  c6WebhookDeletar,
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

// GET - Listar webhooks
export async function GET(request: Request) {
  try {
    const config = await getC6Config()
    const { searchParams } = new URL(request.url)
    const service = (searchParams.get('service') || 'BANK_SLIP') as 'BANK_SLIP' | 'CHECKOUT'
    const data = await c6WebhookListar(config, service)
    return NextResponse.json(data)
  } catch (error) {
    console.error('C6 Webhook GET error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 500 })
  }
}

// POST - Registrar webhook
export async function POST(request: Request) {
  try {
    const config = await getC6Config()
    const body = await request.json()
    const service = (body.service || 'BANK_SLIP') as 'BANK_SLIP' | 'CHECKOUT'
    if (!body.url) return NextResponse.json({ error: 'URL obrigatória' }, { status: 400 })
    const data = await c6WebhookRegistrar(config, service, body.url)
    return NextResponse.json(data)
  } catch (error) {
    console.error('C6 Webhook POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 500 })
  }
}

// DELETE - Deletar webhook
export async function DELETE(request: Request) {
  try {
    const config = await getC6Config()
    const { searchParams } = new URL(request.url)
    const service = (searchParams.get('service') || 'BANK_SLIP') as 'BANK_SLIP' | 'CHECKOUT'
    const data = await c6WebhookDeletar(config, service)
    return NextResponse.json(data)
  } catch (error) {
    console.error('C6 Webhook DELETE error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro' }, { status: 500 })
  }
}
