// ============================================================
// WEBHOOK WHATSAPP: Recebe mensagens da Evolution API + Consultor IA
// ============================================================
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getOpenAIConfig, chatFinanceiro } from '@/lib/ai-engine'

export const dynamic = 'force-dynamic'

// Buscar credenciais da Evolution API
async function getEvolutionConfig() {
  try {
    const supabase = createServerSupabase()
    const { data } = await supabase
      .from('_financeiro_integracoes')
      .select('*')
      .eq('provedor', 'evolution_api')
      .eq('ativa', true)
      .single() as { data: { api_key: string; configuracoes_extra: Record<string, string> } | null }
    if (data) {
      return {
        url: data.configuracoes_extra?.api_url || '',
        key: data.api_key || '',
        instance: data.configuracoes_extra?.instance_name || 'farolfinance',
      }
    }
  } catch { /* fallback */ }
  return {
    url: process.env.EVOLUTION_API_URL || '',
    key: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || 'farolfinance',
  }
}

// Enviar resposta via Evolution API
async function enviarResposta(telefone: string, mensagem: string) {
  const { url, key, instance } = await getEvolutionConfig()
  if (!url || !key) return

  let numero = telefone.replace(/\D/g, '')
  if (!numero.includes('@')) {
    if (!numero.startsWith('55') && numero.length <= 11) numero = '55' + numero
    numero = numero + '@s.whatsapp.net'
  }

  await fetch(`${url}/message/sendText/${instance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ number: numero.replace('@s.whatsapp.net', ''), text: mensagem }),
  })
}

// Buscar número do admin (para verificar se a mensagem é do dono)
async function getNumeroAdmin(): Promise<string | null> {
  try {
    const supabase = createServerSupabase()
    const { data } = await supabase
      .from('_financeiro_preferencias_notificacao')
      .select('numero_whatsapp')
      .limit(1)
      .single() as { data: { numero_whatsapp: string | null } | null }
    return data?.numero_whatsapp || null
  } catch {
    return null
  }
}

// POST - Recebe webhooks da Evolution API
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Evolution API v2 webhook format
    const event = body.event || body.type
    const messageData = body.data || body

    // Só processar mensagens recebidas (não enviadas por nós)
    if (event !== 'messages.upsert' && event !== 'message') {
      return NextResponse.json({ ok: true })
    }

    // Extrair info da mensagem
    const message = messageData.message || messageData
    const key = message.key || messageData.key || {}
    
    // Ignorar mensagens enviadas por nós
    if (key.fromMe) {
      return NextResponse.json({ ok: true })
    }

    // Telefone do remetente
    const remoteJid = key.remoteJid || messageData.remoteJid || ''
    const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')

    // Ignorar grupos
    if (remoteJid.includes('@g.us')) {
      return NextResponse.json({ ok: true })
    }

    // Extrair texto da mensagem
    const texto = message.message?.conversation
      || message.message?.extendedTextMessage?.text
      || message.body
      || messageData.body
      || ''

    if (!texto || typeof texto !== 'string') {
      return NextResponse.json({ ok: true })
    }

    // Verificar se é do admin (por segurança, só responde ao dono)
    const adminNum = await getNumeroAdmin()
    if (adminNum) {
      const adminNormalizado = adminNum.replace(/\D/g, '')
      const remetenteNormalizado = telefone.replace(/\D/g, '')
      // Comparar últimos 11 dígitos (sem código do país)
      const adminUltimos = adminNormalizado.slice(-11)
      const remetenteUltimos = remetenteNormalizado.slice(-11)
      if (adminUltimos !== remetenteUltimos) {
        // Não é o admin - ignorar silenciosamente ou responder genérico
        return NextResponse.json({ ok: true })
      }
    }

    // Verificar se OpenAI está configurada
    const aiConfig = await getOpenAIConfig()
    if (!aiConfig) {
      await enviarResposta(telefone, '⚠️ O módulo de IA não está configurado. Configure a API da OpenAI em Integrações > OpenAI no painel web.')
      return NextResponse.json({ ok: true })
    }

    // Comandos rápidos sem IA (mais rápido)
    const textoLower = texto.trim().toLowerCase()
    
    if (textoLower === '/ajuda' || textoLower === '/help' || textoLower === 'menu') {
      const help = `🤖 *Farol Finance - Consultor IA*

Eu posso te ajudar com suas finanças! Exemplos:

💰 *Saldos e contas*
• "Qual meu saldo?"
• "Como estão minhas contas?"

📊 *Gastos e análises*
• "Quanto gastei este mês?"
• "Quais meus maiores gastos?"
• "Compare com o mês passado"

⏳ *Contas a pagar/receber*
• "O que vence essa semana?"
• "Tenho contas atrasadas?"

💳 *Cartões*
• "Como estão meus cartões?"

📈 *Relatórios*
• "Me dê um resumo financeiro"
• "Gere um relatório do mês"

🎯 *Análises*
• "Minha saúde financeira está boa?"
• "Preciso economizar em quê?"

Ou pergunte qualquer coisa sobre suas finanças! 🚀`
      await enviarResposta(telefone, help)
      return NextResponse.json({ ok: true })
    }

    // Processar com IA
    const resposta = await chatFinanceiro(texto, aiConfig)

    // Enviar resposta
    await enviarResposta(telefone, resposta)

    // Logar conversa
    const supabase = createServerSupabase()
    await supabase.from('_financeiro_notificacoes_log').insert({
      tipo: 'consultor_ia',
      destinatario_telefone: telefone,
      mensagem: `[PERGUNTA] ${texto}\n\n[RESPOSTA] ${resposta.substring(0, 500)}`,
      status: 'respondido',
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    // Sempre retornar 200 para não bloquear webhooks futuros
    return NextResponse.json({ ok: true })
  }
}

// GET - Para validação de webhook (Evolution API pode usar GET para health check)
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'farol-finance-whatsapp-ia' })
}
