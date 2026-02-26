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

    // Limpar campos opcionais vazios para null
    const optionalFields = ['franquia_id', 'usuario_id', 'api_key', 'api_secret', 'access_token', 'webhook_url']
    for (const field of optionalFields) {
      if (body[field] === '' || body[field] === undefined) body[field] = null
    }
    // Garantir defaults
    if (body.ativa === undefined) body.ativa = true
    if (!body.configuracoes_extra) body.configuracoes_extra = {}

    const { data, error } = await supabase
      .from('_financeiro_integracoes')
      .insert(body)
      .select()
      .single()

    if (error) {
      console.error('Integrações POST Supabase error:', error)
      return NextResponse.json({ error: error.message || 'Erro ao criar integração', code: error.code }, { status: 500 })
    }
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

    // Limpar campos opcionais vazios para null
    const optionalFields = ['franquia_id', 'usuario_id', 'api_key', 'api_secret', 'access_token', 'webhook_url']
    for (const field of optionalFields) {
      if (updateData[field] === '' || updateData[field] === undefined) updateData[field] = null
    }

    const { data, error } = await supabase
      .from('_financeiro_integracoes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Integrações PUT Supabase error:', error)
      return NextResponse.json({ error: error.message || 'Erro ao atualizar integração', code: error.code }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Integrações PUT error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar integração' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id } = body
    const supabase = createServerSupabase()

    const { error } = await supabase
      .from('_financeiro_integracoes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Integrações DELETE error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Integrações DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao excluir integração' }, { status: 500 })
  }
}
