// ============================================================
// API IA - Orçamento Inteligente: sugestões por categoria
// ============================================================
import { NextResponse } from 'next/server'
import { getOpenAIConfig, sugerirOrcamentos } from '@/lib/ai-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await getOpenAIConfig()
    if (!config) {
      return NextResponse.json({ error: 'OpenAI não configurada' }, { status: 400 })
    }

    const result = await sugerirOrcamentos(config)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Orçamento IA error:', error)
    return NextResponse.json({ error: 'Erro ao sugerir orçamentos' }, { status: 500 })
  }
}
