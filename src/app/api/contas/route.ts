import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createServerSupabase()
    const { data, error } = await supabase
      .from('_financeiro_contas_bancarias')
      .select('*')
      .eq('ativa', true)
      .order('nome')

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Contas GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar contas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServerSupabase()

    // Limpar campos vazios
    if (!body.franquia_id) body.franquia_id = null
    if (!body.usuario_id) body.usuario_id = null

    const { data, error } = await supabase
      .from('_financeiro_contas_bancarias')
      .insert({ ...body, saldo_atual: body.saldo_inicial || 0 })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Contas POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const supabase = createServerSupabase()
    const { data, error } = await supabase
      .from('_financeiro_contas_bancarias')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Contas PUT error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar conta' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const supabase = createServerSupabase()
    const { error } = await supabase
      .from('_financeiro_contas_bancarias')
      .update({ ativa: false })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contas DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao desativar conta' }, { status: 500 })
  }
}
