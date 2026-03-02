// ============================================================
// API IA - Detecção de Duplicatas/Anomalias
// ============================================================
import { NextResponse } from 'next/server'
import { detectarDuplicatas } from '@/lib/ai-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await detectarDuplicatas()
    return NextResponse.json({
      duplicatas: result.grupos,
      total: result.grupos.length,
      mensagem: result.grupos.length > 0
        ? `Encontradas ${result.grupos.length} possíveis duplicatas nos últimos 30 dias`
        : 'Nenhuma duplicata encontrada nos últimos 30 dias',
    })
  } catch (error) {
    console.error('Duplicatas error:', error)
    return NextResponse.json({ error: 'Erro ao detectar duplicatas' }, { status: 500 })
  }
}
