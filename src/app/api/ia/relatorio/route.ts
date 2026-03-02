// ============================================================
// API IA - Relatórios Financeiros em Linguagem Natural
// ============================================================
import { NextResponse } from 'next/server'
import { getOpenAIConfig, gerarRelatorio } from '@/lib/ai-engine'

export const dynamic = 'force-dynamic'

// GET - Relatório completo (padrão) ou resumido
export async function GET(request: Request) {
  try {
    const config = await getOpenAIConfig()
    if (!config) {
      return NextResponse.json({ error: 'OpenAI não configurada' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const formato = searchParams.get('formato') as 'completo' | 'resumido' | 'whatsapp' || 'completo'

    const relatorio = await gerarRelatorio(config, formato)

    return NextResponse.json({ relatorio, formato })
  } catch (error) {
    console.error('Relatório IA error:', error)
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 })
  }
}
