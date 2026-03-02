// ============================================================
// API IA - Regularizar Transações (franquia/categoria em massa)
// ============================================================
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getOpenAIConfig } from '@/lib/ai-engine'
import { categorizarTransacoes, CategoriaInfo, FranquiaInfo } from '@/lib/categorization'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServerSupabase()

    // ============================================================
    // AÇÃO 1: Atribuir franquia "Pessoal" a transações sem franquia
    // ============================================================
    if (body.acao === 'franquia_pessoal') {
      const ids: string[] = body.ids || []

      // Buscar a franquia "Pessoal" (ou criar se não existir)
      let { data: franquiaPessoal } = await supabase
        .from('_financeiro_franquias')
        .select('id')
        .ilike('nome', '%pessoal%')
        .eq('ativa', true)
        .limit(1)
        .single() as { data: { id: string } | null }

      if (!franquiaPessoal) {
        // Criar franquia "Pessoal" automaticamente
        const { data: novaFranquia, error: errCriar } = await supabase
          .from('_financeiro_franquias')
          .insert({ nome: 'Pessoal', ativa: true })
          .select('id')
          .single()

        if (errCriar) throw errCriar
        franquiaPessoal = novaFranquia as { id: string }
      }

      if (ids.length === 0) {
        // Atualizar TODAS sem franquia
        const { data, error } = await supabase
          .from('_financeiro_transacoes')
          .update({ franquia_id: franquiaPessoal.id })
          .is('franquia_id', null)
          .neq('status', 'cancelado')
          .select('id')

        if (error) throw error
        return NextResponse.json({
          sucesso: true,
          atualizadas: data?.length || 0,
          franquia_id: franquiaPessoal.id,
          mensagem: `${data?.length || 0} transações atualizadas para franquia "Pessoal"`,
        })
      } else {
        // Atualizar apenas os IDs específicos
        const { data, error } = await supabase
          .from('_financeiro_transacoes')
          .update({ franquia_id: franquiaPessoal.id })
          .in('id', ids)
          .select('id')

        if (error) throw error
        return NextResponse.json({
          sucesso: true,
          atualizadas: data?.length || 0,
          franquia_id: franquiaPessoal.id,
          mensagem: `${data?.length || 0} transações atualizadas para franquia "Pessoal"`,
        })
      }
    }

    // ============================================================
    // AÇÃO 2: Auto-classificar com IA (categoria + franquia)
    // ============================================================
    if (body.acao === 'auto_classificar') {
      const ids: string[] = body.ids || []

      // Buscar transações a classificar
      let query = supabase
        .from('_financeiro_transacoes')
        .select('id, descricao, tipo, categoria_id, franquia_id')
        .neq('status', 'cancelado')

      if (ids.length > 0) {
        query = query.in('id', ids)
      } else {
        query = query.or('categoria_id.is.null,franquia_id.is.null')
      }

      const { data: transacoes, error } = await query.limit(300) as {
        data: { id: string; descricao: string; tipo: string; categoria_id: string | null; franquia_id: string | null }[] | null
        error: unknown
      }

      if (error) throw error
      if (!transacoes || transacoes.length === 0) {
        return NextResponse.json({ sucesso: true, atualizadas: 0, mensagem: 'Nenhuma transação para classificar' })
      }

      // Buscar categorias e franquias
      const [catRes, franqRes] = await Promise.all([
        supabase.from('_financeiro_categorias').select('id, nome, tipo').eq('ativa', true),
        supabase.from('_financeiro_franquias').select('id, nome').eq('ativa', true),
      ])

      const categorias = (catRes.data || []) as CategoriaInfo[]
      const franquias = (franqRes.data || []) as FranquiaInfo[]

      // Filtrar apenas as que precisam de classificação
      const descricoes = transacoes.map(t => t.descricao)

      // Buscar API key da OpenAI
      const openaiConfig = await getOpenAIConfig()

      // Rodar motor de categorização com franquias
      const resultados = await categorizarTransacoes(
        descricoes,
        categorias,
        supabase,
        openaiConfig?.apiKey || null,
        franquias
      )

      // Aplicar resultados
      let atualizadas = 0
      const detalhes: { id: string; descricao: string; categoria?: string; franquia?: string; metodo: string }[] = []

      for (let i = 0; i < transacoes.length; i++) {
        const t = transacoes[i]
        const r = resultados[i]
        if (!r) continue

        const updates: Record<string, unknown> = {}
        let changed = false

        // Atualizar categoria se não tinha e IA encontrou
        if (!t.categoria_id && r.categoria_id) {
          updates.categoria_id = r.categoria_id
          changed = true
        }

        // Atualizar franquia se não tinha e IA encontrou
        if (!t.franquia_id && r.franquia_id) {
          updates.franquia_id = r.franquia_id
          changed = true
        }

        if (changed) {
          const { error: upErr } = await supabase
            .from('_financeiro_transacoes')
            .update(updates)
            .eq('id', t.id)

          if (!upErr) {
            atualizadas++
            detalhes.push({
              id: t.id,
              descricao: t.descricao,
              categoria: r.categoria_nome || undefined,
              franquia: r.franquia_nome || undefined,
              metodo: r.metodo,
            })
          }
        }
      }

      return NextResponse.json({
        sucesso: true,
        total_analisadas: transacoes.length,
        atualizadas,
        detalhes: detalhes.slice(0, 50),
        mensagem: `${atualizadas} de ${transacoes.length} transações classificadas`,
      })
    }

    return NextResponse.json({ error: 'Ação não reconhecida. Use: franquia_pessoal ou auto_classificar' }, { status: 400 })
  } catch (error) {
    console.error('Regularizar error:', error)
    return NextResponse.json({ error: 'Erro ao regularizar transações' }, { status: 500 })
  }
}
