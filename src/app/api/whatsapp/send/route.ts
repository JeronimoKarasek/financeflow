import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Buscar credenciais da Evolution API no banco, fallback para env vars
async function getEvolutionConfig() {
  try {
    const supabase = createServerSupabase()
    const { data } = await supabase
      .from('_financeiro_integracoes')
      .select('*')
      .eq('provedor', 'evolution_api')
      .eq('ativa', true)
      .single()
    if (data) {
      return {
        url: (data.configuracoes_extra?.api_url as string) || '',
        key: data.api_key || '',
        instance: (data.configuracoes_extra?.instance_name as string) || 'farolfinance',
        numero_whatsapp: (data.configuracoes_extra?.numero_whatsapp as string) || '',
      }
    }
  } catch { /* fallback abaixo */ }
  return {
    url: process.env.EVOLUTION_API_URL || '',
    key: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || 'farolfinance',
    numero_whatsapp: '',
  }
}

// Enviar mensagem via Evolution API (WhatsApp)
export async function POST(request: Request) {
  try {
    const { telefone, mensagem, nome } = await request.json()

    if (!telefone || !mensagem) {
      return NextResponse.json({ error: 'Telefone e mensagem são obrigatórios' }, { status: 400 })
    }

    const { url: evolutionUrl, key: evolutionKey, instance } = await getEvolutionConfig()

    if (!evolutionUrl || !evolutionKey) {
      return NextResponse.json({ error: 'Evolution API não configurada. Vá em Integrações e configure a Evolution API.' }, { status: 400 })
    }

    // Formatar número para WhatsApp
    let numero = telefone.replace(/\D/g, '')
    if (numero.length === 11) numero = '55' + numero
    if (numero.length === 10) numero = '55' + numero
    if (!numero.startsWith('55')) numero = '55' + numero

    const response = await fetch(`${evolutionUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionKey,
      },
      body: JSON.stringify({
        number: numero,
        text: mensagem,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || 'Erro ao enviar mensagem')
    }

    // Salvar log da notificação
    const supabase = createServerSupabase()

    await supabase.from('_financeiro_notificacoes_log').insert({
      tipo: 'personalizado',
      destinatario_telefone: telefone,
      destinatario_nome: nome || null,
      mensagem,
      status: 'enviado',
    })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('WhatsApp send error:', error)
    return NextResponse.json({ error: 'Erro ao enviar mensagem WhatsApp' }, { status: 500 })
  }
}
