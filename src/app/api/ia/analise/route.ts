// ============================================================
// API IA - Análise Preditiva e Alertas
// ============================================================
import { NextResponse } from 'next/server'
import { getOpenAIConfig, analisePreditiva } from '@/lib/ai-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await getOpenAIConfig()
    if (!config) {
      return NextResponse.json({ error: 'OpenAI não configurada' }, { status: 400 })
    }

    const result = await analisePreditiva(config)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Análise preditiva error:', error)
    return NextResponse.json({ error: 'Erro ao gerar análise preditiva' }, { status: 500 })
  }
}
