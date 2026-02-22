import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createServerSupabase()
    const { data, error } = await supabase
      .from('_financeiro_integracoes')
      .select('*')
      .order('provedor')

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Integrações GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar integrações' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('_financeiro_integracoes')
      .insert(body)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Integrações POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar integração' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body
    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('_financeiro_integracoes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Integrações PUT error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar integração' }, { status: 500 })
  }
}
