// ============================================================
// API IA - Insights para Dashboard
// ============================================================
import { NextResponse } from 'next/server'
import { getOpenAIConfig, gerarInsights, calcularScoreSaude } from '@/lib/ai-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await getOpenAIConfig()
    if (!config) {
      return NextResponse.json({ error: 'OpenAI não configurada. Vá em Integrações e configure.' }, { status: 400 })
    }

    const [insightsResult, scoreResult] = await Promise.all([
      gerarInsights(config),
      calcularScoreSaude(config),
    ])

    return NextResponse.json({
      insights: insightsResult.insights,
      score: scoreResult,
    })
  } catch (error) {
    console.error('Insights IA error:', error)
    return NextResponse.json({ error: 'Erro ao gerar insights' }, { status: 500 })
  }
}
