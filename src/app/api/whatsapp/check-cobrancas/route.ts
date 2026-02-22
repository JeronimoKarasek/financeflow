import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// CRON/Webhook para verificar cobranças e enviar lembretes
export async function POST() {
  try {
    const supabase = createServerSupabase()
    const evolutionUrl = process.env.EVOLUTION_API_URL
    const evolutionKey = process.env.EVOLUTION_API_KEY
    const instance = process.env.EVOLUTION_INSTANCE || 'farolfinance'

    if (!evolutionUrl || !evolutionKey) {
      return NextResponse.json({ error: 'Evolution API não configurada' }, { status: 400 })
    }

    // Marcar cobranças atrasadas
    await supabase.rpc('_financeiro_marcar_atrasados')

    // Buscar cobranças que precisam de notificação
    const hoje = new Date()
    const { data: cobrancas } = await supabase
      .from('_financeiro_cobrancas')
      .select('*')
      .eq('notificar_whatsapp', true)
      .in('status', ['pendente', 'atrasado'])
      .not('telefone_contato', 'is', null)

    if (!cobrancas || cobrancas.length === 0) {
      return NextResponse.json({ message: 'Nenhuma cobrança para notificar', enviados: 0 })
    }

    let enviados = 0
    const erros: string[] = []

    for (const cobranca of cobrancas) {
      const vencimento = new Date(cobranca.data_vencimento)
      const diasParaVencer = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

      // Verificar se é hora de notificar
      const deveNotificar = 
        (diasParaVencer <= (cobranca.dias_antes_notificar || 3) && diasParaVencer >= 0) || // Lembrete
        (diasParaVencer < 0) // Atrasado

      if (!deveNotificar) continue

      // Verificar se já notificou hoje
      if (cobranca.ultima_notificacao) {
        const ultimaNotif = new Date(cobranca.ultima_notificacao)
        const diffHoras = (hoje.getTime() - ultimaNotif.getTime()) / (1000 * 60 * 60)
        if (diffHoras < 24) continue
      }

      // Montar mensagem
      let mensagem = ''
      const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cobranca.valor))
      const dataFormatada = vencimento.toLocaleDateString('pt-BR')

      if (cobranca.tipo === 'receber') {
        if (diasParaVencer < 0) {
          mensagem = `⚠️ *COBRANÇA VENCIDA*\n\nOlá${cobranca.nome_contato ? ' ' + cobranca.nome_contato : ''}!\n\nInformamos que a cobrança *${cobranca.descricao}* no valor de *${valorFormatado}* venceu em *${dataFormatada}*.\n\nPor favor, regularize o pagamento o mais breve possível.\n\n_Farol Finance - Gestão Financeira_`
        } else {
          mensagem = `📋 *LEMBRETE DE PAGAMENTO*\n\nOlá${cobranca.nome_contato ? ' ' + cobranca.nome_contato : ''}!\n\nLembramos que a cobrança *${cobranca.descricao}* no valor de *${valorFormatado}* vence em *${dataFormatada}* (${diasParaVencer} dia${diasParaVencer > 1 ? 's' : ''}).\n\n${cobranca.link_pagamento ? '🔗 Link de pagamento: ' + cobranca.link_pagamento + '\n\n' : ''}_Farol Finance - Gestão Financeira_`
        }
      } else {
        if (diasParaVencer <= 0) {
          mensagem = `🔴 *CONTA VENCENDO HOJE*\n\n*${cobranca.descricao}*\nValor: *${valorFormatado}*\nVencimento: *${dataFormatada}*\n\n_Lembrete automático Farol Finance_`
        } else {
          mensagem = `🟡 *LEMBRETE DE CONTA*\n\n*${cobranca.descricao}*\nValor: *${valorFormatado}*\nVencimento: *${dataFormatada}* (${diasParaVencer} dias)\n\n_Lembrete automático Farol Finance_`
        }
      }

      try {
        let numero = (cobranca.telefone_contato || '').replace(/\D/g, '')
        if (numero.length === 11 || numero.length === 10) numero = '55' + numero
        if (!numero.startsWith('55')) numero = '55' + numero

        const response = await fetch(`${evolutionUrl}/message/sendText/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
          body: JSON.stringify({ number: numero, text: mensagem }),
        })

        const result = await response.json()

        // Registrar no log
        await supabase.from('_financeiro_notificacoes_log').insert({
          tipo: diasParaVencer < 0 ? 'cobranca_vencida' : 'cobranca_lembrete',
          destinatario_telefone: cobranca.telefone_contato || '',
          destinatario_nome: cobranca.nome_contato,
          mensagem,
          status: response.ok ? 'enviado' : 'erro',
          erro_detalhes: response.ok ? null : JSON.stringify(result),
          cobranca_id: cobranca.id,
        })

        // Atualizar cobrança
        await supabase
          .from('_financeiro_cobrancas')
          .update({
            ultima_notificacao: new Date().toISOString(),
            notificacoes_enviadas: (cobranca.notificacoes_enviadas || 0) + 1,
          })
          .eq('id', cobranca.id)

        if (response.ok) enviados++
        else erros.push(`${cobranca.descricao}: ${result.message}`)
      } catch (err) {
        erros.push(`${cobranca.descricao}: ${err}`)
      }
    }

    return NextResponse.json({
      message: `Processo concluído: ${enviados} notificações enviadas`,
      enviados,
      erros: erros.length > 0 ? erros : undefined,
    })
  } catch (error) {
    console.error('Cobranças check error:', error)
    return NextResponse.json({ error: 'Erro ao processar cobranças' }, { status: 500 })
  }
}
