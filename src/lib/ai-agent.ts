// ============================================================
// FAROL FINANCE - Agente IA com Function Calling
// Motor que permite ao admin dar ordens via WhatsApp para
// alterar qualquer informação do sistema financeiro.
// ============================================================

import OpenAI from 'openai'
import type { ChatCompletionTool, ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { createServerSupabase } from '@/lib/supabase'
import { coletarContextoFinanceiro } from '@/lib/ai-engine'

// ============================================================
// DEFINIÇÃO DAS TOOLS (Function Calling)
// ============================================================
const AGENT_TOOLS: ChatCompletionTool[] = [
  // ---- TRANSAÇÕES ----
  {
    type: 'function',
    function: {
      name: 'criar_transacao',
      description: 'Cria uma nova transação financeira (receita, despesa ou transferência). Use quando o usuário pedir para registrar/lançar/criar um gasto, receita, pagamento, etc.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['receita', 'despesa', 'transferencia'], description: 'Tipo da transação' },
          descricao: { type: 'string', description: 'Descrição da transação' },
          valor: { type: 'number', description: 'Valor da transação em reais (positivo)' },
          data_vencimento: { type: 'string', description: 'Data de vencimento no formato YYYY-MM-DD' },
          status: { type: 'string', enum: ['pendente', 'pago', 'agendado'], description: 'Status da transação. Default: pendente' },
          categoria_nome: { type: 'string', description: 'Nome da categoria (ex: Alimentação, Salários, etc.) - será buscada automaticamente' },
          conta_nome: { type: 'string', description: 'Nome da conta bancária (se aplicável) - será buscada automaticamente' },
          franquia_nome: { type: 'string', description: 'Nome da franquia/empresa (se aplicável) - será buscada automaticamente' },
          is_pessoal: { type: 'boolean', description: 'Se é uma transação pessoal. Default: false' },
          observacoes: { type: 'string', description: 'Observações adicionais' },
          recorrente: { type: 'boolean', description: 'Se é recorrente. Default: false' },
          parcela_total: { type: 'number', description: 'Número total de parcelas (se parcelado)' },
        },
        required: ['tipo', 'descricao', 'valor', 'data_vencimento'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'alterar_transacao',
      description: 'Altera uma transação existente. Pode mudar status (ex: marcar como pago), valor, descrição, categoria, etc. Busca a transação pela descrição.',
      parameters: {
        type: 'object',
        properties: {
          busca_descricao: { type: 'string', description: 'Trecho da descrição da transação para encontrá-la' },
          busca_valor: { type: 'number', description: 'Valor exato para refinar a busca (opcional)' },
          novo_status: { type: 'string', enum: ['pendente', 'pago', 'atrasado', 'cancelado', 'agendado'], description: 'Novo status' },
          novo_valor: { type: 'number', description: 'Novo valor' },
          nova_descricao: { type: 'string', description: 'Nova descrição' },
          nova_data_vencimento: { type: 'string', description: 'Nova data de vencimento YYYY-MM-DD' },
          data_pagamento: { type: 'string', description: 'Data do pagamento YYYY-MM-DD (ao marcar como pago)' },
          nova_categoria_nome: { type: 'string', description: 'Nome da nova categoria' },
          nova_franquia_nome: { type: 'string', description: 'Nome da nova franquia' },
          nova_conta_nome: { type: 'string', description: 'Nome da nova conta bancária' },
          observacoes: { type: 'string', description: 'Novas observações' },
        },
        required: ['busca_descricao'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'excluir_transacao',
      description: 'Exclui uma transação. Busca pela descrição e opcionalmente pelo valor.',
      parameters: {
        type: 'object',
        properties: {
          busca_descricao: { type: 'string', description: 'Trecho da descrição para encontrar a transação' },
          busca_valor: { type: 'number', description: 'Valor exato para refinar busca (opcional)' },
        },
        required: ['busca_descricao'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_transacoes',
      description: 'Lista/consulta transações com filtros. Use para ver transações pendentes, pagas, atrasadas, por período, etc.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['receita', 'despesa', 'transferencia'], description: 'Filtrar por tipo' },
          status: { type: 'string', enum: ['pendente', 'pago', 'atrasado', 'cancelado', 'agendado'], description: 'Filtrar por status' },
          data_inicio: { type: 'string', description: 'Data início YYYY-MM-DD' },
          data_fim: { type: 'string', description: 'Data fim YYYY-MM-DD' },
          busca: { type: 'string', description: 'Buscar por descrição' },
          limite: { type: 'number', description: 'Quantidade máxima de resultados. Default: 10' },
          franquia_nome: { type: 'string', description: 'Filtrar por franquia' },
          is_pessoal: { type: 'boolean', description: 'Filtrar pessoais' },
        },
      },
    },
  },
  // ---- COBRANÇAS ----
  {
    type: 'function',
    function: {
      name: 'criar_cobranca',
      description: 'Cria uma nova cobrança (a receber ou a pagar). Use quando o usuário quiser cobrar alguém ou registrar uma conta a pagar/receber.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['receber', 'pagar'], description: 'Tipo: receber (cliente deve) ou pagar (você deve)' },
          descricao: { type: 'string', description: 'Descrição da cobrança' },
          valor: { type: 'number', description: 'Valor em reais' },
          data_vencimento: { type: 'string', description: 'Data de vencimento YYYY-MM-DD' },
          nome_contato: { type: 'string', description: 'Nome do contato/cliente' },
          telefone_contato: { type: 'string', description: 'Telefone do contato (para cobrança WhatsApp)' },
          email_contato: { type: 'string', description: 'Email do contato' },
          notificar_whatsapp: { type: 'boolean', description: 'Enviar cobrança via WhatsApp. Default: true' },
          franquia_nome: { type: 'string', description: 'Nome da franquia vinculada' },
          observacoes: { type: 'string', description: 'Observações' },
        },
        required: ['tipo', 'descricao', 'valor', 'data_vencimento'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'alterar_cobranca',
      description: 'Altera uma cobrança existente. Pode mudar status, valor, data, contato, etc.',
      parameters: {
        type: 'object',
        properties: {
          busca_descricao: { type: 'string', description: 'Trecho da descrição para encontrar a cobrança' },
          busca_valor: { type: 'number', description: 'Valor para refinar busca (opcional)' },
          novo_status: { type: 'string', enum: ['pendente', 'pago', 'atrasado', 'cancelado', 'parcial'], description: 'Novo status' },
          novo_valor: { type: 'number', description: 'Novo valor' },
          nova_descricao: { type: 'string', description: 'Nova descrição' },
          nova_data_vencimento: { type: 'string', description: 'Nova data YYYY-MM-DD' },
          data_pagamento: { type: 'string', description: 'Data do pagamento YYYY-MM-DD' },
          nome_contato: { type: 'string', description: 'Novo nome do contato' },
          telefone_contato: { type: 'string', description: 'Novo telefone' },
          observacoes: { type: 'string', description: 'Novas observações' },
        },
        required: ['busca_descricao'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'excluir_cobranca',
      description: 'Exclui uma cobrança existente.',
      parameters: {
        type: 'object',
        properties: {
          busca_descricao: { type: 'string', description: 'Trecho da descrição para encontrar a cobrança' },
          busca_valor: { type: 'number', description: 'Valor para refinar busca (opcional)' },
        },
        required: ['busca_descricao'],
      },
    },
  },
  // ---- CONTAS BANCÁRIAS ----
  {
    type: 'function',
    function: {
      name: 'criar_conta',
      description: 'Cria uma nova conta bancária.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome da conta' },
          banco: { type: 'string', description: 'Nome do banco' },
          tipo: { type: 'string', enum: ['corrente', 'poupanca', 'investimento', 'carteira_digital', 'caixa'], description: 'Tipo da conta' },
          saldo_inicial: { type: 'number', description: 'Saldo inicial' },
          is_pessoal: { type: 'boolean', description: 'Se é conta pessoal' },
          franquia_nome: { type: 'string', description: 'Nome da franquia vinculada' },
        },
        required: ['nome', 'tipo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'alterar_conta',
      description: 'Altera uma conta bancária existente (saldo, nome, etc.)',
      parameters: {
        type: 'object',
        properties: {
          busca_nome: { type: 'string', description: 'Nome da conta para encontrar' },
          novo_nome: { type: 'string', description: 'Novo nome' },
          novo_saldo: { type: 'number', description: 'Novo saldo atual (ajuste manual)' },
          novo_banco: { type: 'string', description: 'Novo banco' },
        },
        required: ['busca_nome'],
      },
    },
  },
  // ---- CATEGORIAS ----
  {
    type: 'function',
    function: {
      name: 'criar_categoria',
      description: 'Cria uma nova categoria de receita ou despesa.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome da categoria' },
          tipo: { type: 'string', enum: ['receita', 'despesa'], description: 'Tipo' },
          cor: { type: 'string', description: 'Cor hex (ex: #FF6B6B). Default: #6366f1' },
          icone: { type: 'string', description: 'Emoji/ícone. Default: 📁' },
        },
        required: ['nome', 'tipo'],
      },
    },
  },
  // ---- ENVIAR MENSAGEM WHATSAPP ----
  {
    type: 'function',
    function: {
      name: 'enviar_mensagem_whatsapp',
      description: 'Envia uma mensagem de WhatsApp para um número específico. Use quando o admin pedir para enviar mensagem, notificação ou cobrança para alguém.',
      parameters: {
        type: 'object',
        properties: {
          telefone: { type: 'string', description: 'Número de telefone do destinatário (com DDD, ex: 41999999999)' },
          mensagem: { type: 'string', description: 'Texto da mensagem a enviar' },
          nome: { type: 'string', description: 'Nome do destinatário (para log)' },
        },
        required: ['telefone', 'mensagem'],
      },
    },
  },
  // ---- CONSULTAS ----
  {
    type: 'function',
    function: {
      name: 'consultar_saldos',
      description: 'Consulta saldos de todas as contas bancárias.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_cobrancas',
      description: 'Lista cobranças com filtros opcionais.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['receber', 'pagar'], description: 'Filtrar por tipo' },
          status: { type: 'string', enum: ['pendente', 'pago', 'atrasado', 'cancelado', 'parcial'], description: 'Filtrar por status' },
          limite: { type: 'number', description: 'Quantidade máxima. Default: 10' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_cartoes',
      description: 'Consulta informações dos cartões de crédito (limite, usado, datas).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_franquias',
      description: 'Lista todas as franquias/empresas com resumo financeiro.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_categorias',
      description: 'Lista todas as categorias disponíveis.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['receita', 'despesa'], description: 'Filtrar por tipo' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gerar_relatorio',
      description: 'Gera um relatório financeiro (resumo, completo ou para WhatsApp).',
      parameters: {
        type: 'object',
        properties: {
          formato: { type: 'string', enum: ['completo', 'resumido', 'whatsapp'], description: 'Formato do relatório. Default: whatsapp' },
        },
      },
    },
  },
]

// ============================================================
// HELPERS: Buscar IDs por nome
// ============================================================
async function buscarCategoriaId(nome: string): Promise<string | null> {
  const supabase = createServerSupabase()
  const { data } = await supabase
    .from('_financeiro_categorias')
    .select('id, nome')
    .eq('ativa', true)
    .ilike('nome', `%${nome}%`)
    .limit(1)
    .single() as { data: { id: string; nome: string } | null }
  return data?.id || null
}

async function buscarFranquiaId(nome: string): Promise<string | null> {
  const supabase = createServerSupabase()
  const { data } = await supabase
    .from('_financeiro_franquias')
    .select('id, nome')
    .eq('ativa', true)
    .ilike('nome', `%${nome}%`)
    .limit(1)
    .single() as { data: { id: string; nome: string } | null }
  return data?.id || null
}

async function buscarContaId(nome: string): Promise<string | null> {
  const supabase = createServerSupabase()
  const { data } = await supabase
    .from('_financeiro_contas_bancarias')
    .select('id, nome')
    .eq('ativa', true)
    .ilike('nome', `%${nome}%`)
    .limit(1)
    .single() as { data: { id: string; nome: string } | null }
  return data?.id || null
}

// ============================================================
// EXECUTORES DE FUNÇÕES
// ============================================================
async function executarFuncao(
  nome: string,
  args: Record<string, unknown>,
  evolutionConfig: { url: string; key: string; instance: string }
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerSupabase() as any
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  try {
    switch (nome) {
      // ==== CRIAR TRANSAÇÃO ====
      case 'criar_transacao': {
        const payload: Record<string, unknown> = {
          tipo: args.tipo,
          descricao: args.descricao,
          valor: args.valor,
          data_vencimento: args.data_vencimento,
          status: args.status || 'pendente',
          is_pessoal: args.is_pessoal || false,
          recorrente: args.recorrente || false,
          observacoes: args.observacoes || null,
        }
        if (args.parcela_total) {
          payload.parcela_total = args.parcela_total
          payload.parcela_atual = 1
        }
        if (args.categoria_nome) {
          payload.categoria_id = await buscarCategoriaId(String(args.categoria_nome))
        }
        if (args.conta_nome) {
          payload.conta_bancaria_id = await buscarContaId(String(args.conta_nome))
        }
        if (args.franquia_nome) {
          payload.franquia_id = await buscarFranquiaId(String(args.franquia_nome))
        }

        // Se parcelado, criar múltiplas
        if (payload.parcela_total && Number(payload.parcela_total) > 1) {
          const total = Number(payload.parcela_total)
          const grupoParcela = crypto.randomUUID()
          const transacoes = []
          for (let i = 0; i < total; i++) {
            const dt = new Date(String(payload.data_vencimento))
            dt.setMonth(dt.getMonth() + i)
            transacoes.push({
              ...payload,
              valor: (Number(payload.valor) / total).toFixed(2),
              data_vencimento: dt.toISOString().split('T')[0],
              parcela_atual: i + 1,
              grupo_parcela_id: grupoParcela,
            })
          }
          const { error } = await supabase
            .from('_financeiro_transacoes')
            .insert(transacoes)
            .select()
          if (error) return `❌ Erro ao criar parcelas: ${error.message}`
          return `✅ ${total} parcelas criadas!\n${args.descricao}: ${fmt(Number(args.valor))} dividido em ${total}x de ${fmt(Number(args.valor) / total)}`
        }

        const { data, error } = await supabase
          .from('_financeiro_transacoes')
          .insert(payload)
          .select()
          .single()
        if (error) return `❌ Erro ao criar transação: ${error.message}`

        // Se pago, ajustar saldo
        if (payload.status === 'pago' && payload.conta_bancaria_id) {
          const { data: conta } = await supabase
            .from('_financeiro_contas_bancarias')
            .select('saldo_atual')
            .eq('id', payload.conta_bancaria_id)
            .single()
          if (conta) {
            const novoSaldo = payload.tipo === 'receita'
              ? Number(conta.saldo_atual) + Number(payload.valor)
              : Number(conta.saldo_atual) - Number(payload.valor)
            await supabase.from('_financeiro_contas_bancarias').update({ saldo_atual: novoSaldo }).eq('id', payload.conta_bancaria_id)
          }
        }

        return `✅ Transação criada com sucesso!\n📝 ${args.descricao}\n💰 ${fmt(Number(args.valor))}\n📅 ${data.data_vencimento}\n📌 Status: ${data.status}\n🆔 ID: ${data.id}`
      }

      // ==== ALTERAR TRANSAÇÃO ====
      case 'alterar_transacao': {
        let query = supabase
          .from('_financeiro_transacoes')
          .select('id, descricao, valor, status, tipo, data_vencimento, conta_bancaria_id')
          .ilike('descricao', `%${args.busca_descricao}%`)
          .neq('status', 'cancelado')
          .order('created_at', { ascending: false })
          .limit(5)
        
        if (args.busca_valor) {
          query = query.eq('valor', args.busca_valor)
        }
        
        const { data: transacoes } = await query
        if (!transacoes || transacoes.length === 0) {
          return `❌ Nenhuma transação encontrada com "${args.busca_descricao}"`
        }
        
        const t = transacoes[0]
        const updateData: Record<string, unknown> = {}
        if (args.novo_status) updateData.status = args.novo_status
        if (args.novo_valor) updateData.valor = args.novo_valor
        if (args.nova_descricao) updateData.descricao = args.nova_descricao
        if (args.nova_data_vencimento) updateData.data_vencimento = args.nova_data_vencimento
        if (args.data_pagamento) updateData.data_pagamento = args.data_pagamento
        if (args.observacoes) updateData.observacoes = args.observacoes
        if (args.nova_categoria_nome) updateData.categoria_id = await buscarCategoriaId(String(args.nova_categoria_nome))
        if (args.nova_franquia_nome) updateData.franquia_id = await buscarFranquiaId(String(args.nova_franquia_nome))
        if (args.nova_conta_nome) updateData.conta_bancaria_id = await buscarContaId(String(args.nova_conta_nome))

        // Se marcando como pago e não tinha data_pagamento
        if (args.novo_status === 'pago' && !args.data_pagamento) {
          updateData.data_pagamento = new Date().toISOString().split('T')[0]
        }

        const { data: updated, error } = await supabase
          .from('_financeiro_transacoes')
          .update(updateData)
          .eq('id', t.id)
          .select()
          .single()
        
        if (error) return `❌ Erro ao alterar: ${error.message}`

        // Ajustar saldo se marcou como pago
        if (args.novo_status === 'pago' && t.status !== 'pago') {
          const contaId = updateData.conta_bancaria_id || t.conta_bancaria_id
          if (contaId) {
            const { data: conta } = await supabase
              .from('_financeiro_contas_bancarias')
              .select('saldo_atual')
              .eq('id', contaId)
              .single()
            if (conta) {
              const val = Number(updateData.valor || t.valor)
              const novoSaldo = t.tipo === 'receita'
                ? Number(conta.saldo_atual) + val
                : Number(conta.saldo_atual) - val
              await supabase.from('_financeiro_contas_bancarias').update({ saldo_atual: novoSaldo }).eq('id', contaId)
            }
          }
        }

        return `✅ Transação atualizada!\n📝 ${updated.descricao}\n💰 ${fmt(Number(updated.valor))}\n📌 Status: ${updated.status}${transacoes.length > 1 ? `\n⚠️ Havia ${transacoes.length} resultados, alterei o mais recente.` : ''}`
      }

      // ==== EXCLUIR TRANSAÇÃO ====
      case 'excluir_transacao': {
        let query = supabase
          .from('_financeiro_transacoes')
          .select('id, descricao, valor, status, tipo, conta_bancaria_id')
          .ilike('descricao', `%${args.busca_descricao}%`)
          .neq('status', 'cancelado')
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (args.busca_valor) {
          query = query.eq('valor', args.busca_valor)
        }

        const { data: encontradas } = await query
        if (!encontradas || encontradas.length === 0) {
          return `❌ Nenhuma transação encontrada com "${args.busca_descricao}"`
        }

        const t = encontradas[0]

        // Reverter saldo se pago
        if (t.status === 'pago' && t.conta_bancaria_id) {
          const { data: conta } = await supabase
            .from('_financeiro_contas_bancarias')
            .select('saldo_atual')
            .eq('id', t.conta_bancaria_id)
            .single()
          if (conta) {
            const novoSaldo = t.tipo === 'receita'
              ? Number(conta.saldo_atual) - Number(t.valor)
              : Number(conta.saldo_atual) + Number(t.valor)
            await supabase.from('_financeiro_contas_bancarias').update({ saldo_atual: novoSaldo }).eq('id', t.conta_bancaria_id)
          }
        }

        const { error } = await supabase.from('_financeiro_transacoes').delete().eq('id', t.id)
        if (error) return `❌ Erro ao excluir: ${error.message}`
        return `✅ Transação excluída!\n🗑️ ${t.descricao} - ${fmt(Number(t.valor))}`
      }

      // ==== LISTAR TRANSAÇÕES ====
      case 'listar_transacoes': {
        const limite = Number(args.limite) || 10
        let query = supabase
          .from('_financeiro_transacoes')
          .select('descricao, valor, tipo, status, data_vencimento, _financeiro_categorias(nome), _financeiro_franquias(nome)')
          .neq('status', 'cancelado')
          .order('data_vencimento', { ascending: false })
          .limit(limite)
        
        if (args.tipo) query = query.eq('tipo', args.tipo)
        if (args.status) query = query.eq('status', args.status)
        if (args.data_inicio) query = query.gte('data_vencimento', args.data_inicio)
        if (args.data_fim) query = query.lte('data_vencimento', args.data_fim)
        if (args.busca) query = query.ilike('descricao', `%${args.busca}%`)
        if (args.is_pessoal !== undefined) query = query.eq('is_pessoal', args.is_pessoal)
        if (args.franquia_nome) {
          const fId = await buscarFranquiaId(String(args.franquia_nome))
          if (fId) query = query.eq('franquia_id', fId)
        }

        const { data } = await query
        if (!data || data.length === 0) return '📭 Nenhuma transação encontrada com esses filtros.'

        type TransRow = { descricao: string; valor: number; tipo: string; status: string; data_vencimento: string; _financeiro_categorias: { nome: string } | null; _financeiro_franquias: { nome: string } | null }
        const items = (data as TransRow[]).map((t, i) => {
          const emoji = t.tipo === 'receita' ? '💚' : '🔴'
          const cat = t._financeiro_categorias?.nome || ''
          const franq = t._financeiro_franquias?.nome || ''
          return `${i + 1}. ${emoji} ${t.descricao} — ${fmt(Number(t.valor))} [${t.status}] ${new Date(t.data_vencimento).toLocaleDateString('pt-BR')}${cat ? ` | ${cat}` : ''}${franq ? ` | ${franq}` : ''}`
        })
        return `📋 *${data.length} transações encontradas:*\n\n${items.join('\n')}`
      }

      // ==== CRIAR COBRANÇA ====
      case 'criar_cobranca': {
        const payload: Record<string, unknown> = {
          tipo: args.tipo,
          descricao: args.descricao,
          valor: args.valor,
          data_vencimento: args.data_vencimento,
          status: 'pendente',
          nome_contato: args.nome_contato || null,
          telefone_contato: args.telefone_contato || null,
          email_contato: args.email_contato || null,
          notificar_whatsapp: args.notificar_whatsapp !== false,
          dias_antes_notificar: 3,
          notificacoes_enviadas: 0,
          is_pessoal: false,
          observacoes: args.observacoes || null,
        }
        if (args.franquia_nome) {
          payload.franquia_id = await buscarFranquiaId(String(args.franquia_nome))
        }

        const { data, error } = await supabase
          .from('_financeiro_cobrancas')
          .insert(payload)
          .select()
          .single()
        if (error) return `❌ Erro ao criar cobrança: ${error.message}`

        // Criar transação vinculada
        try {
          const transacaoData = {
            descricao: `[Cobrança] ${args.descricao}`,
            valor: args.valor,
            tipo: args.tipo === 'receber' ? 'receita' : 'despesa',
            status: 'pendente',
            data_vencimento: args.data_vencimento,
            franquia_id: payload.franquia_id || null,
            is_pessoal: false,
            observacoes: `Gerado automaticamente pela cobrança: ${data.id}`,
          }
          const { data: trans } = await supabase
            .from('_financeiro_transacoes')
            .insert(transacaoData)
            .select()
            .single()
          if (trans) {
            await supabase.from('_financeiro_cobrancas').update({ transacao_id: trans.id }).eq('id', data.id)
          }
        } catch { /* transação vinculada é bonus */ }

        return `✅ Cobrança criada!\n📝 ${args.descricao}\n💰 ${fmt(Number(args.valor))}\n📅 Venc.: ${new Date(String(args.data_vencimento)).toLocaleDateString('pt-BR')}\n👤 ${args.nome_contato || 'Sem contato'}\n📱 WhatsApp: ${args.notificar_whatsapp !== false ? 'Sim' : 'Não'}`
      }

      // ==== ALTERAR COBRANÇA ====
      case 'alterar_cobranca': {
        let query = supabase
          .from('_financeiro_cobrancas')
          .select('id, descricao, valor, status, transacao_id')
          .ilike('descricao', `%${args.busca_descricao}%`)
          .neq('status', 'cancelado')
          .order('created_at', { ascending: false })
          .limit(3)
        
        if (args.busca_valor) query = query.eq('valor', args.busca_valor)
        
        const { data: cobrancas } = await query
        if (!cobrancas || cobrancas.length === 0) return `❌ Nenhuma cobrança encontrada com "${args.busca_descricao}"`

        const c = cobrancas[0]
        const updateData: Record<string, unknown> = {}
        if (args.novo_status) updateData.status = args.novo_status
        if (args.novo_valor) updateData.valor = args.novo_valor
        if (args.nova_descricao) updateData.descricao = args.nova_descricao
        if (args.nova_data_vencimento) updateData.data_vencimento = args.nova_data_vencimento
        if (args.data_pagamento) updateData.data_pagamento = args.data_pagamento
        if (args.nome_contato) updateData.nome_contato = args.nome_contato
        if (args.telefone_contato) updateData.telefone_contato = args.telefone_contato
        if (args.observacoes) updateData.observacoes = args.observacoes

        const { data: updated, error } = await supabase
          .from('_financeiro_cobrancas')
          .update(updateData)
          .eq('id', c.id)
          .select()
          .single()
        if (error) return `❌ Erro: ${error.message}`

        // Sincronizar transação vinculada
        if (c.transacao_id) {
          const transUpdate: Record<string, unknown> = {}
          if (args.novo_status) transUpdate.status = args.novo_status
          if (args.novo_valor) transUpdate.valor = args.novo_valor
          if (args.nova_descricao) transUpdate.descricao = `[Cobrança] ${args.nova_descricao}`
          if (args.nova_data_vencimento) transUpdate.data_vencimento = args.nova_data_vencimento
          if (args.data_pagamento) transUpdate.data_pagamento = args.data_pagamento
          if (Object.keys(transUpdate).length > 0) {
            await supabase.from('_financeiro_transacoes').update(transUpdate).eq('id', c.transacao_id)
          }
        }

        return `✅ Cobrança atualizada!\n📝 ${updated.descricao}\n💰 ${fmt(Number(updated.valor))}\n📌 Status: ${updated.status}`
      }

      // ==== EXCLUIR COBRANÇA ====
      case 'excluir_cobranca': {
        let query = supabase
          .from('_financeiro_cobrancas')
          .select('id, descricao, valor, transacao_id')
          .ilike('descricao', `%${args.busca_descricao}%`)
          .neq('status', 'cancelado')
          .order('created_at', { ascending: false })
          .limit(1)
        if (args.busca_valor) query = query.eq('valor', args.busca_valor)

        const { data: encontradas } = await query
        if (!encontradas || encontradas.length === 0) return `❌ Nenhuma cobrança encontrada com "${args.busca_descricao}"`

        const c = encontradas[0]
        const { error } = await supabase.from('_financeiro_cobrancas').delete().eq('id', c.id)
        if (error) return `❌ Erro: ${error.message}`

        if (c.transacao_id) {
          await supabase.from('_financeiro_transacoes').update({ status: 'cancelado' }).eq('id', c.transacao_id)
        }
        return `✅ Cobrança excluída!\n🗑️ ${c.descricao} - ${fmt(Number(c.valor))}`
      }

      // ==== CRIAR CONTA ====
      case 'criar_conta': {
        const payload: Record<string, unknown> = {
          nome: args.nome,
          banco: args.banco || null,
          tipo: args.tipo || 'corrente',
          saldo_inicial: args.saldo_inicial || 0,
          saldo_atual: args.saldo_inicial || 0,
          cor: '#6366f1',
          is_pessoal: args.is_pessoal || false,
          ativa: true,
        }
        if (args.franquia_nome) {
          payload.franquia_id = await buscarFranquiaId(String(args.franquia_nome))
        }
        const { data, error } = await supabase
          .from('_financeiro_contas_bancarias')
          .insert(payload)
          .select()
          .single()
        if (error) return `❌ Erro: ${error.message}`
        return `✅ Conta criada!\n🏦 ${data.nome}${data.banco ? ` (${data.banco})` : ''}\n💰 Saldo: ${fmt(Number(data.saldo_atual))}`
      }

      // ==== ALTERAR CONTA ====
      case 'alterar_conta': {
        const { data: conta } = await supabase
          .from('_financeiro_contas_bancarias')
          .select('id, nome, saldo_atual')
          .eq('ativa', true)
          .ilike('nome', `%${args.busca_nome}%`)
          .limit(1)
          .single()
        if (!conta) return `❌ Conta "${args.busca_nome}" não encontrada`

        const updateData: Record<string, unknown> = {}
        if (args.novo_nome) updateData.nome = args.novo_nome
        if (args.novo_saldo !== undefined) updateData.saldo_atual = args.novo_saldo
        if (args.novo_banco) updateData.banco = args.novo_banco

        const { data: updated, error } = await supabase
          .from('_financeiro_contas_bancarias')
          .update(updateData)
          .eq('id', conta.id)
          .select()
          .single()
        if (error) return `❌ Erro: ${error.message}`
        return `✅ Conta atualizada!\n🏦 ${updated.nome}\n💰 Saldo: ${fmt(Number(updated.saldo_atual))}`
      }

      // ==== CRIAR CATEGORIA ====
      case 'criar_categoria': {
        const { data, error } = await supabase
          .from('_financeiro_categorias')
          .insert({
            nome: args.nome,
            tipo: args.tipo,
            cor: args.cor || '#6366f1',
            icone: args.icone || '📁',
            ativa: true,
            is_pessoal: false,
          })
          .select()
          .single()
        if (error) return `❌ Erro: ${error.message}`
        return `✅ Categoria criada!\n${data.icone} ${data.nome} (${data.tipo})`
      }

      // ==== ENVIAR WHATSAPP ====
      case 'enviar_mensagem_whatsapp': {
        if (!evolutionConfig.url || !evolutionConfig.key) {
          return '❌ Evolution API não configurada. Configure em Integrações.'
        }
        let numero = String(args.telefone).replace(/\D/g, '')
        if (!numero.startsWith('55') && numero.length <= 11) numero = '55' + numero

        try {
          const res = await fetch(`${evolutionConfig.url}/message/sendText/${evolutionConfig.instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evolutionConfig.key },
            body: JSON.stringify({ number: numero, text: String(args.mensagem) }),
          })
          if (!res.ok) {
            const err = await res.json()
            return `❌ Erro ao enviar: ${JSON.stringify(err)}`
          }
          // Log
          await supabase.from('_financeiro_notificacoes_log').insert({
            tipo: 'agente_ia',
            destinatario_telefone: numero,
            destinatario_nome: args.nome || null,
            mensagem: String(args.mensagem),
            status: 'enviado',
          })
          return `✅ Mensagem enviada para ${args.nome || numero}!`
        } catch (err) {
          return `❌ Erro de conexão: ${err}`
        }
      }

      // ==== CONSULTAR SALDOS ====
      case 'consultar_saldos': {
        const { data: contas } = await supabase
          .from('_financeiro_contas_bancarias')
          .select('nome, banco, saldo_atual, tipo')
          .eq('ativa', true)
          .order('nome')
        if (!contas || contas.length === 0) return '📭 Nenhuma conta cadastrada'
        const total = contas.reduce((s: number, c: Record<string, unknown>) => s + Number(c.saldo_atual), 0)
        const lista = contas.map((c: Record<string, unknown>) => `🏦 ${c.nome}${c.banco ? ` (${c.banco})` : ''}: ${fmt(Number(c.saldo_atual))}`).join('\n')
        return `💰 *Saldos das Contas:*\n\n${lista}\n\n💵 *Total: ${fmt(total)}*`
      }

      // ==== CONSULTAR COBRANÇAS ====
      case 'consultar_cobrancas': {
        const limite = Number(args.limite) || 10
        let query = supabase
          .from('_financeiro_cobrancas')
          .select('descricao, valor, data_vencimento, status, tipo, nome_contato')
          .neq('status', 'cancelado')
          .order('data_vencimento', { ascending: true })
          .limit(limite)
        if (args.tipo) query = query.eq('tipo', args.tipo)
        if (args.status) query = query.eq('status', args.status)

        const { data } = await query
        if (!data || data.length === 0) return '📭 Nenhuma cobrança encontrada'
        const items = data.map((c: Record<string, unknown>, i: number) => {
          const emoji = c.status === 'pago' ? '✅' : c.status === 'atrasado' ? '🔴' : '⏳'
          return `${i + 1}. ${emoji} ${c.descricao} — ${fmt(Number(c.valor))} [${c.status}] Venc. ${new Date(String(c.data_vencimento)).toLocaleDateString('pt-BR')}${c.nome_contato ? ` | ${c.nome_contato}` : ''}`
        })
        return `📋 *${data.length} cobranças:*\n\n${items.join('\n')}`
      }

      // ==== CONSULTAR CARTÕES ====
      case 'consultar_cartoes': {
        const { data: cartoes } = await supabase
          .from('_financeiro_cartoes_credito')
          .select('nome, bandeira, limite_total, limite_usado, dia_fechamento, dia_vencimento')
          .eq('ativo', true)
        if (!cartoes || cartoes.length === 0) return '📭 Nenhum cartão cadastrado'
        const items = cartoes.map((c: Record<string, unknown>) => {
          const pct = Number(c.limite_total) > 0 ? Math.round((Number(c.limite_usado) / Number(c.limite_total)) * 100) : 0
          const disponivel = Number(c.limite_total) - Number(c.limite_usado)
          return `💳 *${c.nome}* (${c.bandeira})\n   Usado: ${fmt(Number(c.limite_usado))} / ${fmt(Number(c.limite_total))} (${pct}%)\n   Disponível: ${fmt(disponivel)}\n   Fechamento: dia ${c.dia_fechamento} | Vencimento: dia ${c.dia_vencimento}`
        })
        return `💳 *Cartões de Crédito:*\n\n${items.join('\n\n')}`
      }

      // ==== CONSULTAR FRANQUIAS ====
      case 'consultar_franquias': {
        const { data: franquias } = await supabase
          .from('_financeiro_franquias')
          .select('nome, cnpj, cidade, estado, responsavel, telefone')
          .eq('ativa', true)
        if (!franquias || franquias.length === 0) return '📭 Nenhuma franquia cadastrada'
        const items = franquias.map((f: Record<string, unknown>) => {
          return `🏢 *${f.nome}*${f.cnpj ? `\n   CNPJ: ${f.cnpj}` : ''}${f.cidade ? `\n   ${f.cidade}/${f.estado}` : ''}${f.responsavel ? `\n   Resp.: ${f.responsavel}` : ''}${f.telefone ? `\n   📞 ${f.telefone}` : ''}`
        })
        return `🏢 *Franquias/Empresas:*\n\n${items.join('\n\n')}`
      }

      // ==== CONSULTAR CATEGORIAS ====
      case 'consultar_categorias': {
        let query = supabase
          .from('_financeiro_categorias')
          .select('nome, tipo, icone, cor')
          .eq('ativa', true)
          .order('tipo')
          .order('nome')
        if (args.tipo) query = query.eq('tipo', args.tipo)

        const { data } = await query
        if (!data || data.length === 0) return '📭 Nenhuma categoria encontrada'
        const receitas = data.filter((c: Record<string, unknown>) => c.tipo === 'receita')
        const despesas = data.filter((c: Record<string, unknown>) => c.tipo === 'despesa')
        let result = '🏷️ *Categorias:*\n\n'
        if (receitas.length > 0) {
          result += '*💚 Receitas:*\n' + receitas.map((c: Record<string, unknown>) => `  ${c.icone} ${c.nome}`).join('\n') + '\n\n'
        }
        if (despesas.length > 0) {
          result += '*🔴 Despesas:*\n' + despesas.map((c: Record<string, unknown>) => `  ${c.icone} ${c.nome}`).join('\n')
        }
        return result
      }

      // ==== GERAR RELATÓRIO ====
      case 'gerar_relatorio': {
        const contexto = await coletarContextoFinanceiro()
        return contexto.resumo
      }

      default:
        return `❌ Função "${nome}" não reconhecida`
    }
  } catch (err) {
    console.error(`[Agent] Erro ao executar "${nome}":`, err)
    return `❌ Erro interno ao executar "${nome}": ${err instanceof Error ? err.message : String(err)}`
  }
}

// ============================================================
// AGENTE: CHAT COM FUNCTION CALLING
// ============================================================
export async function agenteFinanceiro(
  mensagem: string,
  config: { apiKey: string; model: string },
  evolutionConfig: { url: string; key: string; instance: string }
): Promise<string> {
  const openai = new OpenAI({ apiKey: config.apiKey })
  const contexto = await coletarContextoFinanceiro()

  const hoje = new Date()
  const hojeStr = hoje.toISOString().split('T')[0]

  const systemPrompt = `Você é o *Agente Farol Finance* — um assistente financeiro com PODERES TOTAIS sobre o sistema financeiro.

VOCÊ PODE E DEVE EXECUTAR AÇÕES quando o admin solicitar. Não se limite a informar — FAÇA.

CAPACIDADES:
🔧 TRANSAÇÕES: Criar, alterar (status, valor, categoria, conta), excluir, listar
💸 COBRANÇAS: Criar, alterar, excluir, listar cobranças a pagar/receber
🏦 CONTAS: Criar contas, alterar saldos, consultar saldos
🏷️ CATEGORIAS: Criar novas categorias
📱 WHATSAPP: Enviar mensagens para qualquer número
📊 RELATÓRIOS: Gerar relatórios e consultas

REGRAS:
- Data de hoje: ${hojeStr}
- Responda SEMPRE em português do Brasil
- Use emojis e formatação WhatsApp (*negrito*, _itálico_)
- Limite respostas a 500 palavras
- Quando o admin pedir para FAZER algo (criar, alterar, excluir, pagar, enviar), EXECUTE usando as funções
- Quando pedir informações, CONSULTE os dados reais e responda
- Se o admin disser "pague X" ou "marca X como pago", altere o status para pago
- Se disser "crie uma despesa de X", crie a transação
- Se disser "cobra fulano", crie a cobrança
- Se disser "envie mensagem para fulano", envie via WhatsApp
- Se o admin não especificar data, use a data de hoje: ${hojeStr}
- Se não especificar tipo (receita/despesa), deduza pelo contexto
- Para valores, o admin pode dizer "150", "R$150", "150 reais" — normalize para número
- Confirme SEMPRE a ação realizada com os detalhes
- Se houver ambiguidade, pergunte ao admin antes de agir
- Se o admin pedir algo fora do escopo financeiro, redirecione educadamente
- Ao listar transações, mostre no máximo 15 por vez

CONTEXTO FINANCEIRO ATUAL:
${contexto.resumo}`

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: mensagem },
  ]

  // Loop de function calling (pode precisar de várias chamadas)
  let tentativas = 0
  const maxTentativas = 5

  while (tentativas < maxTentativas) {
    tentativas++

    const response = await openai.chat.completions.create({
      model: config.model,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 2000,
    })

    const choice = response.choices[0]
    const msg = choice.message

    // Se não tem tool calls, retorna a resposta final
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content || 'Pronto! Ação executada.'
    }

    // Adicionar a mensagem do assistente com as tool_calls
    messages.push(msg)

    // Executar cada function call
    for (const toolCall of msg.tool_calls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tc = toolCall as any
      const fnName = tc.function.name
      let fnArgs: Record<string, unknown> = {}
      try {
        fnArgs = JSON.parse(tc.function.arguments)
      } catch {
        fnArgs = {}
      }

      console.log(`[Agent] Executando: ${fnName}`, JSON.stringify(fnArgs).substring(0, 200))
      const resultado = await executarFuncao(fnName, fnArgs, evolutionConfig)
      console.log(`[Agent] Resultado: ${resultado.substring(0, 200)}`)

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: resultado,
      })
    }
  }

  return '⚠️ O agente atingiu o limite de processamento. Tente simplificar seu pedido.'
}
