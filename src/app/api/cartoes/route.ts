import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createServerSupabase()
    const { data, error } = await supabase
      .from('_financeiro_cartoes_credito')
      .select('*, _financeiro_contas_bancarias(nome, banco)')
      .eq('ativo', true)
      .order('nome')

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Cartões GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar cartões' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServerSupabase()

    if (!body.franquia_id) body.franquia_id = null
    if (!body.usuario_id) body.usuario_id = null
    if (!body.conta_bancaria_id) body.conta_bancaria_id = null

    const { data, error } = await supabase
      .from('_financeiro_cartoes_credito')
      .insert({ ...body, limite_usado: 0 })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Cartões POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar cartão' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const supabase = createServerSupabase()

    if (updateData.franquia_id === '') updateData.franquia_id = null
    if (updateData.conta_bancaria_id === '') updateData.conta_bancaria_id = null

    const { data, error } = await supabase
      .from('_financeiro_cartoes_credito')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Cartões PUT error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar cartão' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const supabase = createServerSupabase()
    const { error } = await supabase
      .from('_financeiro_cartoes_credito')
      .update({ ativo: false })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cartões DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao excluir cartão' }, { status: 500 })
  }
}
