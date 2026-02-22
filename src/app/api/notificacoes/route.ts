import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET - Listar notificações
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limite = parseInt(searchParams.get('limite') || '50')

    const supabase = createServerSupabase()

    let query = supabase
      .from('_financeiro_notificacoes_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
