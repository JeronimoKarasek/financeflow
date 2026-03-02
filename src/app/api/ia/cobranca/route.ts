// ============================================================
// API IA - Cobrança Inteligente (mensagem personalizada)
// ============================================================
import { NextResponse } from 'next/server'
import { getOpenAIConfig, gerarMensagemCobranca } from '@/lib/ai-engine'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST - Gerar mensagem de cobrança inteligente
export async function POST(request: Request) {
  try {
    const config = await getOpenAIConfig()
    if (!config) {
      return NextResponse.json({ error: 'OpenAI não configurada' }, { status: 400 })
    }

    const { cobranca_id } = await request.json()

    if (!cobranca_id) {
      return NextResponse.json({ error: 'cobranca_id é obrigatório' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    const { data: cobranca } = await supabase
      .from('_financeiro_cobrancas')
      .select('*')
      .eq('id', cobranca_id)
      .single() as { data: { descricao: string; valor: number; data_vencimento: string; nome_contato: string; tentativas_envio: number } | null }

    if (!cobranca) {
      return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })
    }

    const hoje = new Date()
    const vencimento = new Date(cobranca.data_vencimento)
    const diasAtraso = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24))

    const mensagem = await gerarMensagemCobranca(config, {
      descricao: cobranca.descricao,
      valor: Number(cobranca.valor),
      data_vencimento: cobranca.data_vencimento,
      nome_contato: cobranca.nome_contato || 'Cliente',
      dias_atraso: diasAtraso,
      tentativas: cobranca.tentativas_envio || 0,
    })

    return NextResponse.json({ mensagem, dias_atraso: diasAtraso })
  } catch (error) {
    console.error('Cobrança IA error:', error)
    return NextResponse.json({ error: 'Erro ao gerar mensagem' }, { status: 500 })
  }
}
