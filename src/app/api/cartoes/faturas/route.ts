import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Meses por extenso para descrições
const mesesNome = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// GET: buscar faturas de um cartão
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cartaoId = searchParams.get('cartao_id')
    const ano = searchParams.get('ano')
    const mes = searchParams.get('mes')

    const supabase = createServerSupabase()
    let query = supabase
      .from('_financeiro_faturas_cartao')
      .select('*, _financeiro_cartoes_credito(nome, bandeira, banco)')
      .order('ano_referencia', { ascending: false })
      .order('mes_referencia', { ascending: false })

    if (cartaoId) query = query.eq('cartao_credito_id', cartaoId)
    if (ano) query = query.eq('ano_referencia', parseInt(ano))
    if (mes) query = query.eq('mes_referencia', parseInt(mes))

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Faturas GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar faturas' }, { status: 500 })
  }
}

// POST: buscar gastos de uma fatura (transações vinculadas ao cartão naquele mês)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cartao_id, mes, ano } = body

    if (!cartao_id || !mes || !ano) {
      return NextResponse.json({ error: 'cartao_id, mes e ano obrigatórios' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    // Buscar o cartão para saber o dia de fechamento
    const { data: cartao } = await supabase
      .from('_financeiro_cartoes_credito')
      .select('dia_fechamento, dia_vencimento, nome')
      .eq('id', cartao_id)
      .single()

    if (!cartao) {
      return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 })
    }

    // Período da fatura: do fechamento do mês anterior até fechamento deste mês
    const diaFechamento = cartao.dia_fechamento
    const mesAnterior = mes === 1 ? 12 : mes - 1
    const anoAnterior = mes === 1 ? ano - 1 : ano
    const dataInicio = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(diaFechamento).padStart(2, '0')}`
    const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(diaFechamento).padStart(2, '0')}`

    // Buscar transações do cartão neste período
    const { data: transacoes, error } = await supabase
      .from('_financeiro_transacoes')
      .select('*, _financeiro_categorias(nome, cor, icone)')
      .eq('cartao_credito_id', cartao_id)
      .gte('data_vencimento', dataInicio)
      .lt('data_vencimento', dataFim)
      .order('data_vencimento', { ascending: false })

    if (error) throw error

    // Calcular total da fatura
    const totalFatura = (transacoes || []).reduce((sum: number, t: { valor: number }) => sum + Number(t.valor), 0)

    // Upsert na fatura
    const dataVencimento = `${ano}-${String(mes).padStart(2, '0')}-${String(cartao.dia_vencimento).padStart(2, '0')}`
    
    await supabase
      .from('_financeiro_faturas_cartao')
      .upsert({
        cartao_credito_id: cartao_id,
        mes_referencia: mes,
        ano_referencia: ano,
        data_fechamento: dataFim,
        data_vencimento: dataVencimento,
        valor_total: totalFatura,
      }, { onConflict: 'cartao_credito_id,mes_referencia,ano_referencia' })

    // Buscar o status atual da fatura para retornar
    const { data: faturaAtual } = await supabase
      .from('_financeiro_faturas_cartao')
      .select('*')
      .eq('cartao_credito_id', cartao_id)
      .eq('mes_referencia', mes)
      .eq('ano_referencia', ano)
      .single()

    return NextResponse.json({
      transacoes,
      total: totalFatura,
      fatura: faturaAtual || null,
    })
  } catch (error) {
    console.error('Faturas POST error:', error)
    return NextResponse.json({ error: 'Erro ao buscar fatura' }, { status: 500 })
  }
}

// PUT: Fechar fatura (cria despesa automática) ou Pagar fatura 
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { cartao_id, mes, ano, acao, conta_bancaria_id } = body

    if (!cartao_id || !mes || !ano || !acao) {
      return NextResponse.json({ error: 'cartao_id, mes, ano e acao são obrigatórios' }, { status: 400 })
    }

    const supabase = createServerSupabase()

    // Buscar cartão completo
    const { data: cartao } = await supabase
      .from('_financeiro_cartoes_credito')
      .select('*')
      .eq('id', cartao_id)
      .single()

    if (!cartao) {
      return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 })
    }

    // Buscar fatura existente
    const { data: fatura } = await supabase
      .from('_financeiro_faturas_cartao')
      .select('*')
      .eq('cartao_credito_id', cartao_id)
      .eq('mes_referencia', mes)
      .eq('ano_referencia', ano)
      .single()

    if (!fatura) {
      return NextResponse.json({ error: 'Fatura não encontrada. Visualize a fatura primeiro para criá-la.' }, { status: 404 })
    }

    // ============================================================
    // AÇÃO: FECHAR FATURA
    // Cria uma transação de despesa com o valor total da fatura
    // ============================================================
    if (acao === 'fechar') {
      if (fatura.status !== 'aberta') {
        return NextResponse.json({ error: `Fatura já está ${fatura.status}. Só é possível fechar faturas abertas.` }, { status: 400 })
      }

      if (fatura.valor_total <= 0) {
        return NextResponse.json({ error: 'Fatura sem valor. Não há gastos para fechar.' }, { status: 400 })
      }

      // Buscar categoria "Fatura Cartão de Crédito" (criar se não existir)
      let { data: categoriaFatura } = await supabase
        .from('_financeiro_categorias')
        .select('id')
        .eq('nome', 'Fatura Cartão de Crédito')
        .eq('tipo', 'despesa')
        .single()

      if (!categoriaFatura) {
        const { data: novaCat } = await supabase
          .from('_financeiro_categorias')
          .insert({
            nome: 'Fatura Cartão de Crédito',
            tipo: 'despesa',
            cor: '#ef4444',
            icone: '💳',
            is_pessoal: false,
            ativa: true,
          })
          .select('id')
          .single()
        categoriaFatura = novaCat
      }

      // Criar transação de despesa para a fatura
      const descricao = `Fatura ${cartao.nome} - ${mesesNome[mes]}/${ano}`
      const contaPagamento = conta_bancaria_id || cartao.conta_bancaria_id

      const { data: transacaoCriada, error: errTransacao } = await supabase
        .from('_financeiro_transacoes')
        .insert({
          tipo: 'despesa',
          descricao,
          valor: fatura.valor_total,
          data_vencimento: fatura.data_vencimento,
          data_pagamento: null,
          status: 'pendente',
          categoria_id: categoriaFatura?.id || null,
          conta_bancaria_id: contaPagamento || null,
          franquia_id: cartao.franquia_id || null,
          is_pessoal: cartao.is_pessoal || false,
          usuario_id: cartao.usuario_id || null,
          recorrente: false,
          observacoes: `Fatura fechada automaticamente. Cartão: ${cartao.nome} (${cartao.bandeira}). Período: ${mesesNome[mes]}/${ano}.`,
          tags: ['fatura-cartao', 'automatico'],
        })
        .select()
        .single()

      if (errTransacao) {
        console.error('Erro ao criar transação da fatura:', errTransacao)
        return NextResponse.json({ error: 'Erro ao criar despesa da fatura: ' + errTransacao.message }, { status: 500 })
      }

      // Atualizar fatura: status fechada + link para transação
      const { error: errFatura } = await supabase
        .from('_financeiro_faturas_cartao')
        .update({
          status: 'fechada',
          transacao_pagamento_id: transacaoCriada.id,
        })
        .eq('id', fatura.id)

      if (errFatura) {
        console.error('Erro ao atualizar status da fatura:', errFatura)
        // Reverter: deletar transação criada
        await supabase.from('_financeiro_transacoes').delete().eq('id', transacaoCriada.id)
        return NextResponse.json({ error: 'Erro ao fechar fatura: ' + errFatura.message }, { status: 500 })
      }

      // Marcar gastos individuais do cartão como "pago" (a fatura agora representa a dívida)
      const diaFechamento = cartao.dia_fechamento
      const mesAnterior = mes === 1 ? 12 : mes - 1
      const anoAnterior = mes === 1 ? ano - 1 : ano
      const dataInicio = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(diaFechamento).padStart(2, '0')}`
      const dataFimPeriodo = `${ano}-${String(mes).padStart(2, '0')}-${String(diaFechamento).padStart(2, '0')}`

      await supabase
        .from('_financeiro_transacoes')
        .update({ status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] })
        .eq('cartao_credito_id', cartao_id)
        .in('status', ['pendente', 'atrasado'])
        .gte('data_vencimento', dataInicio)
        .lt('data_vencimento', dataFimPeriodo)

      // Zerar limite usado do cartão (os gastos foram consolidados na fatura)
      await supabase
        .from('_financeiro_cartoes_credito')
        .update({ limite_usado: 0 })
        .eq('id', cartao_id)

      return NextResponse.json({
        success: true,
        message: `Fatura fechada! Despesa de R$ ${Number(fatura.valor_total).toFixed(2)} criada com vencimento em ${fatura.data_vencimento}.`,
        transacao: transacaoCriada,
        fatura: { ...fatura, status: 'fechada', transacao_pagamento_id: transacaoCriada.id },
      })
    }

    // ============================================================
    // AÇÃO: PAGAR FATURA
    // Marca a transação como paga e debita da conta bancária
    // ============================================================
    if (acao === 'pagar') {
      if (fatura.status === 'paga') {
        return NextResponse.json({ error: 'Fatura já está paga.' }, { status: 400 })
      }

      if (fatura.status === 'aberta') {
        return NextResponse.json({ error: 'Feche a fatura antes de pagar.' }, { status: 400 })
      }

      const contaPagamento = conta_bancaria_id || cartao.conta_bancaria_id
      if (!contaPagamento) {
        return NextResponse.json({ error: 'Nenhuma conta bancária vinculada ao cartão. Informe a conta para débito.' }, { status: 400 })
      }

      // Se há transação de pagamento vinculada, marcar como paga
      if (fatura.transacao_pagamento_id) {
        const { error: errPagamento } = await supabase
          .from('_financeiro_transacoes')
          .update({
            status: 'pago',
            data_pagamento: new Date().toISOString().split('T')[0],
            conta_bancaria_id: contaPagamento,
          })
          .eq('id', fatura.transacao_pagamento_id)

        if (errPagamento) {
          console.error('Erro ao pagar transação:', errPagamento)
          return NextResponse.json({ error: 'Erro ao processar pagamento: ' + errPagamento.message }, { status: 500 })
        }

        // Debitar da conta bancária
        const { data: conta } = await supabase
          .from('_financeiro_contas_bancarias')
          .select('saldo_atual')
          .eq('id', contaPagamento)
          .single()

        if (conta) {
          const novoSaldo = Number(conta.saldo_atual) - Number(fatura.valor_total)
          await supabase
            .from('_financeiro_contas_bancarias')
            .update({ saldo_atual: novoSaldo })
            .eq('id', contaPagamento)
        }
      }

      // Atualizar fatura como paga
      const { error: errFatura } = await supabase
        .from('_financeiro_faturas_cartao')
        .update({
          status: 'paga',
          valor_pago: fatura.valor_total,
        })
        .eq('id', fatura.id)

      if (errFatura) {
        console.error('Erro ao atualizar fatura:', errFatura)
        return NextResponse.json({ error: 'Erro ao marcar fatura como paga: ' + errFatura.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Fatura paga! R$ ${Number(fatura.valor_total).toFixed(2)} debitado da conta.`,
        fatura: { ...fatura, status: 'paga', valor_pago: fatura.valor_total },
      })
    }

    // ============================================================
    // AÇÃO: REABRIR FATURA (desfazer fechamento)
    // ============================================================
    if (acao === 'reabrir') {
      if (fatura.status === 'aberta') {
        return NextResponse.json({ error: 'Fatura já está aberta.' }, { status: 400 })
      }

      if (fatura.status === 'paga') {
        return NextResponse.json({ error: 'Não é possível reabrir uma fatura já paga. Estorne o pagamento primeiro.' }, { status: 400 })
      }

      // Deletar a transação de despesa criada no fechamento
      if (fatura.transacao_pagamento_id) {
        await supabase
          .from('_financeiro_transacoes')
          .delete()
          .eq('id', fatura.transacao_pagamento_id)
      }

      // Voltar status da fatura para aberta
      await supabase
        .from('_financeiro_faturas_cartao')
        .update({
          status: 'aberta',
          transacao_pagamento_id: null,
        })
        .eq('id', fatura.id)

      // Recalcular limite usado do cartão
      const { data: pendentes } = await supabase
        .from('_financeiro_transacoes')
        .select('valor')
        .eq('cartao_credito_id', cartao_id)
        .eq('tipo', 'despesa')
        .in('status', ['pendente', 'atrasado'])

      const limiteUsado = pendentes?.reduce((s: number, t: { valor: number }) => s + Number(t.valor), 0) || 0
      await supabase
        .from('_financeiro_cartoes_credito')
        .update({ limite_usado: limiteUsado })
        .eq('id', cartao_id)

      return NextResponse.json({
        success: true,
        message: 'Fatura reaberta com sucesso.',
        fatura: { ...fatura, status: 'aberta', transacao_pagamento_id: null },
      })
    }

    return NextResponse.json({ error: 'Ação inválida. Use: fechar, pagar ou reabrir' }, { status: 400 })
  } catch (error) {
    console.error('Faturas PUT error:', error)
    return NextResponse.json({ error: 'Erro ao processar fatura' }, { status: 500 })
  }
}
