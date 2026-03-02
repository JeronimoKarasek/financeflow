// ============================================================
// WEBHOOK WHATSAPP: Recebe mensagens da Evolution API + Consultor IA
// Suporta Evolution API v1 e v2 (múltiplos formatos de payload)
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
  if (!url || !key) {
    console.error('[WA Webhook] Evolution API não configurada - url:', !!url, 'key:', !!key)
    return
  }

  let numero = telefone.replace(/\D/g, '')
  if (!numero.includes('@')) {
    if (!numero.startsWith('55') && numero.length <= 11) numero = '55' + numero
  }

  console.log('[WA Webhook] Enviando resposta para:', numero, '| Tamanho:', mensagem.length)

  try {
    const res = await fetch(`${url}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: JSON.stringify({ number: numero, text: mensagem }),
    })
    const result = await res.json()
    if (!res.ok) {
      console.error('[WA Webhook] Erro Evolution API:', res.status, JSON.stringify(result))
    }
  } catch (err) {
    console.error('[WA Webhook] Erro ao enviar resposta:', err)
  }
}

// Buscar número do admin
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

// ============================================================
// Extrair dados da mensagem (suporta múltiplos formatos Evolution API)
// ============================================================
interface MensagemExtraida {
  texto: string
  telefone: string
  fromMe: boolean
  isGroup: boolean
}

function extrairMensagem(body: Record<string, unknown>): MensagemExtraida | null {
  try {
    // Evolution API pode enviar data como objeto ou array
    let messageData: Record<string, unknown> = body
    
    if (body.data) {
      if (Array.isArray(body.data)) {
        // v2: data é array de mensagens — pegar a primeira
        messageData = (body.data as Record<string, unknown>[])[0] || {}
      } else {
        messageData = body.data as Record<string, unknown>
      }
    }

    // Extrair key (contém fromMe e remoteJid)
    const key = (messageData.key || body.key || {}) as Record<string, unknown>
    const fromMe = !!(key.fromMe)
    const remoteJid = String(key.remoteJid || messageData.remoteJid || body.remoteJid || '')
    const isGroup = remoteJid.includes('@g.us')
    const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')

    // Extrair texto da mensagem — cobrir todos os formatos conhecidos
    const msgObj = (messageData.message || {}) as Record<string, unknown>
    
    // Prioridade de extração:
    // 1) message.conversation (mensagem simples)
    // 2) message.extendedTextMessage.text (mensagem com link/menção)
    // 3) message.buttonsResponseMessage.selectedDisplayText (botões)
    // 4) message.listResponseMessage.title (listas)
    // 5) messageData.body (alguns formatos legacy)
    // 6) body.text (formato alternativo)
    const extendedText = (msgObj.extendedTextMessage || {}) as Record<string, unknown>
    const buttonsResp = (msgObj.buttonsResponseMessage || {}) as Record<string, unknown>
    const listResp = (msgObj.listResponseMessage || {}) as Record<string, unknown>

    const texto = String(
      msgObj.conversation
      || extendedText.text
      || buttonsResp.selectedDisplayText
      || listResp.title
      || messageData.body
      || body.body
      || body.text
      || ''
    ).trim()

    return { texto, telefone, fromMe, isGroup }
  } catch (err) {
    console.error('[WA Webhook] Erro ao extrair mensagem:', err)
    return null
  }
}

// ============================================================
// POST - Recebe webhooks da Evolution API
// ============================================================
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Log do evento para debug
    const event = String(body.event || body.type || '').toLowerCase()
    console.log('[WA Webhook] Evento recebido:', event, '| Instance:', body.instance || '-')

    // Só processar mensagens recebidas
    const eventosValidos = ['messages.upsert', 'message', 'messages_upsert']
    if (!eventosValidos.includes(event)) {
      // Evento não é de mensagem (pode ser status, connection, etc.)
      return NextResponse.json({ ok: true, ignored: event })
    }

    // Extrair dados da mensagem
    const msg = extrairMensagem(body)
    if (!msg) {
      console.log('[WA Webhook] Não foi possível extrair mensagem do payload')
      return NextResponse.json({ ok: true })
    }

    console.log('[WA Webhook] Mensagem:', {
      telefone: msg.telefone,
      fromMe: msg.fromMe,
      isGroup: msg.isGroup,
      textoLen: msg.texto.length,
      textoPrev: msg.texto.substring(0, 80),
    })

    // Ignorar mensagens enviadas por nós
    if (msg.fromMe) {
      return NextResponse.json({ ok: true, ignored: 'fromMe' })
    }

    // Ignorar grupos
    if (msg.isGroup) {
      return NextResponse.json({ ok: true, ignored: 'group' })
    }

    // Ignorar mensagens vazias (imagens, áudio, stickers, etc.)
    if (!msg.texto) {
      console.log('[WA Webhook] Mensagem sem texto (mídia?) - ignorando')
      return NextResponse.json({ ok: true, ignored: 'no_text' })
    }

    // Verificar se é do admin (por segurança, só responde ao dono)
    const adminNum = await getNumeroAdmin()
    console.log('[WA Webhook] Admin:', adminNum ? adminNum.slice(-4) + '****' : 'NÃO CONFIGURADO')

    if (adminNum) {
      const adminNormalizado = adminNum.replace(/\D/g, '')
      const remetenteNormalizado = msg.telefone.replace(/\D/g, '')
      const adminUltimos = adminNormalizado.slice(-11)
      const remetenteUltimos = remetenteNormalizado.slice(-11)
      if (adminUltimos !== remetenteUltimos) {
        console.log('[WA Webhook] Remetente não é admin:', remetenteUltimos.slice(-4), '≠', adminUltimos.slice(-4))
        return NextResponse.json({ ok: true, ignored: 'not_admin' })
      }
    } else {
      // Se não tem admin configurado, responde a qualquer um (perigoso mas funcional)
      console.log('[WA Webhook] SEM admin configurado — respondendo a qualquer remetente')
    }

    // Verificar se OpenAI está configurada
    const aiConfig = await getOpenAIConfig()
    if (!aiConfig) {
      console.log('[WA Webhook] OpenAI NÃO configurada')
      await enviarResposta(msg.telefone, '⚠️ O módulo de IA não está configurado.\n\nConfigure a API da OpenAI em:\n*Painel Web → Integrações → OpenAI*')
      return NextResponse.json({ ok: true, status: 'no_ai_config' })
    }

    console.log('[WA Webhook] OpenAI OK, modelo:', aiConfig.model)

    // Comandos rápidos sem IA
    const textoLower = msg.texto.toLowerCase()
    
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
      await enviarResposta(msg.telefone, help)
      return NextResponse.json({ ok: true, status: 'help_sent' })
    }

    // Processar com IA
    console.log('[WA Webhook] Chamando chatFinanceiro...')
    const resposta = await chatFinanceiro(msg.texto, aiConfig)
    console.log('[WA Webhook] Resposta IA gerada, tamanho:', resposta.length)

    // Enviar resposta
    await enviarResposta(msg.telefone, resposta)

    // Logar conversa
    try {
      const supabase = createServerSupabase()
      await supabase.from('_financeiro_notificacoes_log').insert({
        tipo: 'consultor_ia',
        destinatario_telefone: msg.telefone,
        mensagem: `[PERGUNTA] ${msg.texto}\n\n[RESPOSTA] ${resposta.substring(0, 500)}`,
        status: 'respondido',
      })
    } catch (logErr) {
      console.error('[WA Webhook] Erro ao salvar log:', logErr)
    }

    return NextResponse.json({ ok: true, status: 'responded' })
  } catch (error) {
    console.error('[WA Webhook] ERRO GERAL:', error)
    // Sempre retornar 200 para não bloquear webhooks futuros
    return NextResponse.json({ ok: true, error: 'internal_error' })
  }
}

// GET - Health check / validação de webhook
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    service: 'farol-finance-whatsapp-ia',
    timestamp: new Date().toISOString(),
  })
}
