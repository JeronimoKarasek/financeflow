// ============================================================
// WEBHOOK WHATSAPP: Recebe mensagens da Evolution API + Agente IA
// Suporta Evolution API v1 e v2 (múltiplos formatos de payload)
// O Agente IA pode executar ações no sistema financeiro via
// function calling do OpenAI (criar/alterar/excluir transações,
// cobranças, contas, categorias, enviar mensagens, etc.)
// Webhook URL: https://financeiro.farolbase.com/api/whatsapp/webhook
// ============================================================
import { NextResponse, after } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getOpenAIConfig } from '@/lib/ai-engine'
import { agenteFinanceiro } from '@/lib/ai-agent'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel Pro: até 60s

// Buscar credenciais da Evolution API + número do WhatsApp configurado
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
        numero_whatsapp: data.configuracoes_extra?.numero_whatsapp || '',
      }
    }
  } catch { /* fallback */ }
  return {
    url: process.env.EVOLUTION_API_URL || '',
    key: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || 'farolfinance',
    numero_whatsapp: '',
  }
}

// Enviar resposta via Evolution API — sempre responde no número configurado na integração
async function enviarResposta(telefone: string, mensagem: string) {
  const config = await getEvolutionConfig()
  if (!config.url || !config.key) {
    console.error('[WA Webhook] Evolution API não configurada - url:', !!config.url, 'key:', !!config.key)
    return
  }

  let numero = telefone.replace(/\D/g, '')
  if (!numero.includes('@')) {
    if (!numero.startsWith('55') && numero.length <= 11) numero = '55' + numero
  }

  console.log('[WA Webhook] Enviando resposta para:', numero, '| Tamanho:', mensagem.length)

  // Quebrar mensagens longas (WhatsApp tem limite de ~4096 chars)
  const MAX_LEN = 4000
  const partes: string[] = []
  if (mensagem.length <= MAX_LEN) {
    partes.push(mensagem)
  } else {
    let restante = mensagem
    while (restante.length > 0) {
      if (restante.length <= MAX_LEN) {
        partes.push(restante)
        break
      }
      // Tentar quebrar em \n próximo do limite
      let corte = restante.lastIndexOf('\n', MAX_LEN)
      if (corte < MAX_LEN * 0.5) corte = MAX_LEN
      partes.push(restante.substring(0, corte))
      restante = restante.substring(corte).trimStart()
    }
  }

  for (const parte of partes) {
    try {
      const res = await fetch(`${config.url}/message/sendText/${config.instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.key },
        body: JSON.stringify({ number: numero, text: parte }),
      })
      const result = await res.json()
      if (!res.ok) {
        console.error('[WA Webhook] Erro Evolution API:', res.status, JSON.stringify(result))
      }
      // Pequeno delay entre partes
      if (partes.length > 1) await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.error('[WA Webhook] Erro ao enviar resposta:', err)
    }
  }
}

// Buscar número do admin — prioridade: integração Evolution API > preferências de notificação
async function getNumeroAdmin(): Promise<string | null> {
  try {
    // 1) Buscar do número configurado na integração Evolution API
    const evolutionConfig = await getEvolutionConfig()
    if (evolutionConfig.numero_whatsapp) {
      return evolutionConfig.numero_whatsapp
    }

    // 2) Fallback: preferências de notificação
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
    console.log('[WA Webhook] Payload keys:', Object.keys(body).join(', '))
    
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

    console.log('[WA Webhook] MessageData keys:', Object.keys(messageData).join(', '))

    // Extrair key (contém fromMe e remoteJid)
    const key = (messageData.key || body.key || {}) as Record<string, unknown>
    const fromMe = !!(key.fromMe)
    const remoteJid = String(key.remoteJid || messageData.remoteJid || body.remoteJid || '')
    const isGroup = remoteJid.includes('@g.us')
    const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')

    // Verificar se é do tipo statusMessage (ignorar)
    if (messageData.messageType === 'protocolMessage' || messageData.messageType === 'senderKeyDistributionMessage') {
      console.log('[WA Webhook] Tipo de mensagem ignorado:', messageData.messageType)
      return null
    }

    // Extrair texto da mensagem — cobrir todos os formatos conhecidos
    const msgObj = (messageData.message || {}) as Record<string, unknown>
    
    // Prioridade de extração:
    // 1) message.conversation (mensagem simples)
    // 2) message.extendedTextMessage.text (mensagem com link/menção)
    // 3) message.buttonsResponseMessage.selectedDisplayText (botões)
    // 4) message.listResponseMessage.title (listas)
    // 5) message.templateButtonReplyMessage.selectedDisplayText (template)
    // 6) messageData.body (Evolution API v2 simplificado)
    // 7) body.body / body.text (formatos alternativos)
    const extendedText = (msgObj.extendedTextMessage || {}) as Record<string, unknown>
    const buttonsResp = (msgObj.buttonsResponseMessage || {}) as Record<string, unknown>
    const listResp = (msgObj.listResponseMessage || {}) as Record<string, unknown>
    const templateResp = (msgObj.templateButtonReplyMessage || {}) as Record<string, unknown>
    const imageMsg = (msgObj.imageMessage || {}) as Record<string, unknown>
    const videoMsg = (msgObj.videoMessage || {}) as Record<string, unknown>
    const docMsg = (msgObj.documentMessage || {}) as Record<string, unknown>

    const texto = String(
      msgObj.conversation
      || extendedText.text
      || buttonsResp.selectedDisplayText
      || listResp.title
      || templateResp.selectedDisplayText
      || imageMsg.caption
      || videoMsg.caption
      || docMsg.caption
      || messageData.body
      || body.body
      || body.text
      || ''
    ).trim()

    console.log('[WA Webhook] Extraído:', { telefone, fromMe, isGroup, textoLen: texto.length, textoPrev: texto.substring(0, 50) })

    return { texto, telefone, fromMe, isGroup }
  } catch (err) {
    console.error('[WA Webhook] Erro ao extrair mensagem:', err)
    return null
  }
}

// ============================================================
// POST - Recebe webhooks da Evolution API
// Responde 200 imediatamente e processa em background via after()
// ============================================================
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Log do evento para debug
    const event = String(body.event || body.type || body.action || '').toLowerCase()
    console.log('[WA Webhook] ====== NOVO EVENTO ======')
    console.log('[WA Webhook] Evento:', event, '| Instance:', body.instance || body.instanceName || '-')
    console.log('[WA Webhook] Body keys:', Object.keys(body).join(', '))

    // Só processar mensagens recebidas
    // Evolution API v1: messages.upsert | v2: MESSAGES_UPSERT | outros: message
    const eventosValidos = ['messages.upsert', 'message', 'messages_upsert', 'messages']
    if (!eventosValidos.includes(event) && event !== '') {
      // Evento não é de mensagem (pode ser status, connection, qrcode, etc.)
      console.log('[WA Webhook] Evento ignorado:', event)
      return NextResponse.json({ ok: true, ignored: event })
    }

    // Se não tem event definido, pode ser payload direto da Evolution API
    // Nesse caso, tentamos extrair a mensagem mesmo assim

    // Extrair dados da mensagem
    const msg = extrairMensagem(body)
    if (!msg) {
      console.log('[WA Webhook] Não foi possível extrair mensagem do payload:', JSON.stringify(body).substring(0, 500))
      return NextResponse.json({ ok: true, status: 'no_message_extracted' })
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

    // Processar em background usando after() — responde 200 imediatamente
    after(async () => {
      try {
        await processarMensagem(msg)
      } catch (err) {
        console.error('[WA Webhook] Erro no processamento background:', err)
      }
    })

    return NextResponse.json({ ok: true, status: 'processing' })
  } catch (error) {
    console.error('[WA Webhook] ERRO ao parsear body:', error)
    // Sempre retornar 200 para não bloquear webhooks futuros
    return NextResponse.json({ ok: true, error: 'parse_error' })
  }
}

// ============================================================
// Processamento em background (chamado via after())
// ============================================================
async function processarMensagem(msg: MensagemExtraida) {
  // Verificar se é do admin (por segurança, só responde ao dono)
  const adminNum = await getNumeroAdmin()
  console.log('[WA Webhook] Admin configurado:', adminNum || 'NENHUM')

  if (adminNum) {
    const adminNormalizado = adminNum.replace(/\D/g, '')
    const remetenteNormalizado = msg.telefone.replace(/\D/g, '')
    // Comparar últimos 11 dígitos (ignora código do país)
    const adminUltimos = adminNormalizado.slice(-11)
    const remetenteUltimos = remetenteNormalizado.slice(-11)
    console.log('[WA Webhook] Comparando:', remetenteUltimos, 'vs admin:', adminUltimos)
    if (adminUltimos !== remetenteUltimos) {
      console.log('[WA Webhook] Remetente NÃO é admin — ignorando')
      return
    }
    console.log('[WA Webhook] ✓ Remetente é admin!')
  } else {
    console.log('[WA Webhook] SEM admin configurado — respondendo a qualquer remetente')
  }

  // Verificar se OpenAI está configurada
  const aiConfig = await getOpenAIConfig()
  if (!aiConfig) {
    console.log('[WA Webhook] OpenAI NÃO configurada')
    const numeroResposta = adminNum || msg.telefone
    await enviarResposta(numeroResposta, '⚠️ O módulo de IA não está configurado.\n\nConfigure a API da OpenAI em:\n*Painel Web → Integrações → OpenAI*')
    return
  }

  console.log('[WA Webhook] OpenAI OK, modelo:', aiConfig.model)

  // Buscar config da Evolution para passar ao agente
  const evolutionCfg = await getEvolutionConfig()

  // Número para responder — sempre usa o número configurado na integração
  const numeroResposta = evolutionCfg.numero_whatsapp
    ? evolutionCfg.numero_whatsapp.replace(/\D/g, '')
    : msg.telefone

  console.log('[WA Webhook] Número para resposta:', numeroResposta)

  // Comandos rápidos sem IA
  const textoLower = msg.texto.toLowerCase().trim()
  
  if (textoLower === '/ajuda' || textoLower === '/help' || textoLower === 'menu') {
    const help = `🤖 *Agente Farol Finance — IA com Poderes Totais*

Eu sou seu assistente financeiro e posso *executar ações* no sistema! Exemplos:

💰 *Consultas*
• "Qual meu saldo?"
• "Quais contas vencem essa semana?"
• "Mostre minhas transações de março"
• "Como estão meus cartões?"

✏️ *Criar/Registrar*
• "Registre uma despesa de R$150 em Alimentação"
• "Crie uma receita de R$5000 de venda"
• "Crie uma cobrança de R$1200 para João"
• "Crie uma categoria Uber de despesa"

🔄 *Alterar*
• "Marque o aluguel como pago"
• "Altere o valor da internet para R$120"
• "Mude o status da cobrança do João"
• "Ajuste o saldo da conta Nubank para R$3000"

🗑️ *Excluir*
• "Exclua a transação de Material de Escritório"
• "Delete a cobrança do Pedro"

📱 *WhatsApp*
• "Envie uma mensagem para 41999999999"
• "Cobre o João no WhatsApp"

📊 *Relatórios*
• "Me dê um resumo financeiro"
• "Gere um relatório do mês"
• "Minha saúde financeira está boa?"

_Pergunte qualquer coisa ou dê uma ordem!_ 🚀`
    await enviarResposta(numeroResposta, help)
    return
  }

  // Processar com Agente IA (function calling)
  console.log('[WA Webhook] Chamando agenteFinanceiro...')
  try {
    const resposta = await agenteFinanceiro(msg.texto, aiConfig, {
      url: evolutionCfg.url,
      key: evolutionCfg.key,
      instance: evolutionCfg.instance,
    })
    console.log('[WA Webhook] Resposta Agente gerada, tamanho:', resposta.length)

    // Enviar resposta — sempre no número configurado
    await enviarResposta(numeroResposta, resposta)

    // Logar conversa
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createServerSupabase() as any
      await supabase.from('_financeiro_notificacoes_log').insert({
        tipo: 'agente_ia',
        destinatario_telefone: numeroResposta,
        mensagem: `[PERGUNTA] ${msg.texto}\n\n[RESPOSTA] ${resposta.substring(0, 500)}`,
        status: 'respondido',
      })
    } catch (logErr) {
      console.error('[WA Webhook] Erro ao salvar log:', logErr)
    }
  } catch (aiErr) {
    console.error('[WA Webhook] ERRO no agente IA:', aiErr)
    await enviarResposta(
      numeroResposta,
      '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns segundos.'
    )
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
