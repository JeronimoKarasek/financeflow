import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { categorizarTransacoes, CategoriaInfo } from '@/lib/categorization'

export const dynamic = 'force-dynamic'

// POST: Categorizar transações automaticamente
// Body: { descricoes: string[] } ou { transacao_ids: string[] }
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { descricoes, transacao_ids } = body as {
      descricoes?: string[]
      transacao_ids?: string[]
    }

    const supabase = createServerSupabase()

    // Buscar categorias ativas
    const { data: categoriasRaw, error: catErr } = await supabase
      .from('_financeiro_categorias')
      .select('id, nome, tipo')
      .eq('ativa', true) as { data: { id: string; nome: string; tipo: string }[] | null; error: unknown }

    if (catErr) throw catErr
    const categorias: CategoriaInfo[] = (categoriasRaw || []).map(c => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo as 'receita' | 'despesa',
    }))

    // Buscar API key da OpenAI nas configurações
    const { data: configData } = await supabase
      .from('_financeiro_preferencias_notificacao')
      .select('openai_api_key')
      .limit(1)
      .single() as { data: { openai_api_key: string | null } | null }

    const openaiApiKey = configData?.openai_api_key || null

    let descricoesParaClassificar: string[] = []
    let transacoesMapa: Map<string, string> | null = null // descrição → id

    if (transacao_ids && transacao_ids.length > 0) {
      // Modo: classificar transações existentes (pelo ID)
      const { data: transacoes, error: transErr } = await supabase
        .from('_financeiro_transacoes')
        .select('id, descricao')
        .in('id', transacao_ids) as { data: { id: string; descricao: string }[] | null; error: unknown }

      if (transErr) throw transErr

      transacoesMapa = new Map()
      for (const t of (transacoes || [])) {
        descricoesParaClassificar.push(t.descricao)
        transacoesMapa.set(t.descricao, t.id)
      }
    } else if (descricoes && descricoes.length > 0) {
      // Modo: classificar descrições avulsas (preview)
      descricoesParaClassificar = descricoes
    } else {
      return NextResponse.json({ error: 'Envie "descricoes" ou "transacao_ids"' }, { status: 400 })
    }

    // Executar categorização híbrida
    const resultados = await categorizarTransacoes(
      descricoesParaClassificar,
      categorias,
      supabase,
      openaiApiKey
    )

    // Se foi por transacao_ids, aplicar as categorias automaticamente
    let aplicadas = 0
    if (transacoesMapa) {
      for (const res of resultados) {
        if (res.categoria_id && res.confianca >= 0.5) {
          const transacaoId = transacoesMapa.get(res.descricao)
          if (transacaoId) {
            const updateTable = supabase.from('_financeiro_transacoes')
            const { error } = await (updateTable as unknown as { update: (data: Record<string, string>) => { eq: (col: string, val: string) => { is: (col: string, val: null) => Promise<{ error: unknown }> } } })
              .update({ categoria_id: res.categoria_id })
              .eq('id', transacaoId)
              .is('categoria_id', null) // Só atualiza se ainda não tem categoria

            if (!error) aplicadas++
          }
        }
      }
    }

    // Estatísticas
    const stats = {
      total: resultados.length,
      classificadas: resultados.filter(r => r.categoria_id).length,
      nao_classificadas: resultados.filter(r => !r.categoria_id).length,
      por_historico: resultados.filter(r => r.metodo === 'historico').length,
      por_keywords: resultados.filter(r => r.metodo === 'keywords').length,
      por_openai: resultados.filter(r => r.metodo === 'openai').length,
      aplicadas: transacoesMapa ? aplicadas : undefined,
      openai_ativo: !!openaiApiKey,
    }

    return NextResponse.json({
      success: true,
      resultados,
      stats,
    })
  } catch (error) {
    console.error('Auto-classificar error:', error)
    return NextResponse.json({ error: 'Erro ao categorizar transações' }, { status: 500 })
  }
}
