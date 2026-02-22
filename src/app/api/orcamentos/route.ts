import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET - Listar orçamentos por período
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') || String(new Date().getMonth() + 1)
    const ano = searchParams.get('ano') || String(new Date().getFullYear())
    const franquiaId = searchParams.get('franquia_id')

    const supabase = createServerSupabase()

    let query = supabase
      .from('_financeiro_orcamentos')
      .select('*, categoria:_financeiro_categorias(nome, cor, icone), franquia:_financeiro_franquias(nome)')
      .eq('mes', parseInt(mes))
      .eq('ano', parseInt(ano))
      .order('created_at', { ascending: false })

    if (franquiaId) {
      query = query.eq('franquia_id', franquiaId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Para cada orçamento, calcular o valor realizado com base nas transações reais
    const orcamentosComRealizado = await Promise.all(
      (data || []).map(async (orc) => {
        const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`
        const endDate = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0]

        let transQuery = supabase
          .from('_financeiro_transacoes')
          .select('valor')
          .eq('categoria_id', orc.categoria_id)
          .eq('status', 'pago')
          .gte('data_vencimento', startDate)
          .lte('data_vencimento', endDate)

        if (orc.franquia_id) {
          transQuery = transQuery.eq('franquia_id', orc.franquia_id)
        }

        const { data: transacoes } = await transQuery
        const valor_realizado = (transacoes || []).reduce((sum, t) => sum + Number(t.valor), 0)

        return {
          ...orc,
          categoria_nome: orc.categoria?.nome || 'Sem categoria',
          categoria_cor: orc.categoria?.cor || '#6366f1',
          franquia_nome: orc.franquia?.nome || null,
          valor_realizado,
        }
      })
    )

    return NextResponse.json(orcamentosComRealizado)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST - Criar orçamento
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { categoria_id, franquia_id, mes, ano, valor_previsto, usuario_id } = body

    if (!categoria_id || !mes || !ano || !valor_previsto) {
      return NextResponse.json({ error: 'Campos obrigatórios: categoria_id, mes, ano, valor_previsto' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('_financeiro_orcamentos')
      .insert({
        categoria_id,
        franquia_id: franquia_id || null,
        mes: parseInt(mes),
        ano: parseInt(ano),
        valor_previsto: parseFloat(valor_previsto),
        usuario_id: usuario_id || null,
      })
      .select('*, categoria:_financeiro_categorias(nome, cor), franquia:_financeiro_franquias(nome)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT - Atualizar orçamento
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('_financeiro_orcamentos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE - Remover orçamento
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    const { error } = await supabase
      .from('_financeiro_orcamentos')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
