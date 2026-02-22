import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerSupabase()
    const { data, error } = await supabase
      .from('_financeiro_franquias')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Franquia GET error:', error)
    return NextResponse.json({ error: 'Franquia não encontrada' }, { status: 404 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('_financeiro_franquias')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Franquia PUT error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar franquia' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerSupabase()

    const { error } = await supabase
      .from('_financeiro_franquias')
      .update({ ativa: false })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Franquia DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao remover franquia' }, { status: 500 })
  }
}
