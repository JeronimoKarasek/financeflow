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

    if (error) {
      console.error('Cartões GET Supabase error:', error)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([])
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Recalcular limite_usado dinamicamente a partir de transações pendentes/atrasadas
    const cartoes = data || []
    for (const cartao of cartoes) {
      const { data: pendentes } = await supabase
        .from('_financeiro_transacoes')
        .select('valor')
        .eq('cartao_credito_id', cartao.id)
        .eq('tipo', 'despesa')
        .in('status', ['pendente', 'atrasado'])

      const limiteReal = pendentes?.reduce((s: number, t: { valor: number }) => s + Number(t.valor), 0) || 0
      cartao.limite_usado = limiteReal

      // Atualizar no banco se divergir
      if (Math.abs(limiteReal - Number(cartao.limite_usado)) > 0.01) {
        await supabase
          .from('_financeiro_cartoes_credito')
          .update({ limite_usado: limiteReal })
          .eq('id', cartao.id)
      }
    }

    return NextResponse.json(cartoes)
  } catch (error) {
    console.error('Cartões GET error:', error)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServerSupabase()

    // Limpar campos opcionais vazios para null
    const optionalFields = ['franquia_id', 'usuario_id', 'conta_bancaria_id', 'banco', 'ultimos_digitos']
    for (const field of optionalFields) {
      if (body[field] === '' || body[field] === undefined) body[field] = null
    }

    const { data, error } = await supabase
      .from('_financeiro_cartoes_credito')
      .insert({ ...body, limite_usado: 0 })
      .select()
      .single()

    if (error) {
      console.error('Cartões POST Supabase error:', error)
      return NextResponse.json({ error: error.message || 'Erro ao criar cartão', details: error.code }, { status: 500 })
    }
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

    // Limpar campos opcionais vazios para null
    const optionalFields = ['franquia_id', 'conta_bancaria_id', 'banco', 'ultimos_digitos']
    for (const field of optionalFields) {
      if (updateData[field] === '' || updateData[field] === undefined) updateData[field] = null
    }

    const { data, error } = await supabase
      .from('_financeiro_cartoes_credito')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Cartões PUT Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
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
