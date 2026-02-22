import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createServerSupabase()
    const { data, error } = await supabase
      .from('_financeiro_franquias')
      .select('*')
      .order('nome')

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Franquias GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar franquias' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('_financeiro_franquias')
      .insert(body)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Franquias POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar franquia' }, { status: 500 })
  }
}
