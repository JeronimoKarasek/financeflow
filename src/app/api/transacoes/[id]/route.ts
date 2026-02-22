import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('_financeiro_transacoes')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Transação PUT error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar transação' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerSupabase()

    const { error } = await supabase
      .from('_financeiro_transacoes')
      .update({ status: 'cancelado' })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Transação DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao cancelar transação' }, { status: 500 })
  }
}
