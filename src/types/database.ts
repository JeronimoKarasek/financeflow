// ============================================================
// FAROL FINANCE - Database Types (Supabase)
// ============================================================

export interface Usuario {
  id: string
  email: string
  senha_hash: string
  nome: string
  avatar_url?: string | null
  telefone?: string | null
  role: 'admin' | 'gerente' | 'operador' | 'viewer'
  ativo: boolean
  ultimo_acesso?: string | null
  created_at: string
  updated_at: string
}

export interface Franquia {
  id: string
  nome: string
  cnpj?: string | null
  endereco?: string | null
  cidade?: string | null
  estado?: string | null
  telefone?: string | null
  email?: string | null
  responsavel?: string | null
  cor_tema: string
  logo_url?: string | null
  ativa: boolean
  created_at: string
  updated_at: string
}

export interface Categoria {
  id: string
  nome: string
  tipo: 'receita' | 'despesa'
  cor: string
  icone: string
  franquia_id?: string | null
  is_pessoal: boolean
  usuario_id?: string | null
  ativa: boolean
  created_at: string
}

export interface ContaBancaria {
  id: string
  nome: string
  banco?: string | null
  agencia?: string | null
  numero_conta?: string | null
  tipo: 'corrente' | 'poupanca' | 'investimento' | 'carteira_digital' | 'caixa'
  saldo_inicial: number
  saldo_atual: number
  cor: string
  franquia_id?: string | null
  is_pessoal: boolean
  usuario_id?: string | null
  ativa: boolean
  created_at: string
  updated_at: string
}

export interface Transacao {
  id: string
  tipo: 'receita' | 'despesa' | 'transferencia'
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string | null
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'agendado'
  categoria_id?: string | null
  conta_bancaria_id?: string | null
  conta_destino_id?: string | null
  franquia_id?: string | null
  is_pessoal: boolean
  usuario_id?: string | null
  recorrente: boolean
  recorrencia_tipo?: string | null
  recorrencia_fim?: string | null
  parcela_atual?: number | null
  parcela_total?: number | null
  grupo_parcela_id?: string | null
  comprovante_url?: string | null
  observacoes?: string | null
  tags?: string[] | null
  origem_integracao?: string | null
  id_externo?: string | null
  created_at: string
  updated_at: string
  // Joins
  categoria?: Categoria | null
  conta_bancaria?: ContaBancaria | null
  franquia?: Franquia | null
}

export interface Cobranca {
  id: string
  tipo: 'receber' | 'pagar'
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string | null
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'parcial'
  nome_contato?: string | null
  telefone_contato?: string | null
  email_contato?: string | null
  cpf_cnpj_contato?: string | null
  notificar_whatsapp: boolean
  dias_antes_notificar: number
  ultima_notificacao?: string | null
  notificacoes_enviadas: number
  franquia_id?: string | null
  is_pessoal: boolean
  usuario_id?: string | null
  transacao_id?: string | null
  gateway?: string | null
  link_pagamento?: string | null
  id_externo_gateway?: string | null
  observacoes?: string | null
  created_at: string
  updated_at: string
  // Joins
  franquia?: Franquia | null
}

export interface Integracao {
  id: string
  nome: string
  provedor: string
  api_key?: string | null
  api_secret?: string | null
  access_token?: string | null
  webhook_url?: string | null
  ambiente: 'sandbox' | 'producao'
  configuracoes_extra: Record<string, unknown>
  franquia_id?: string | null
  ativa: boolean
  usuario_id?: string | null
  created_at: string
  updated_at: string
}

export interface Orcamento {
  id: string
  nome: string
  valor_limite: number
  valor_gasto: number
  mes: number
  ano: number
  categoria_id?: string | null
  franquia_id?: string | null
  is_pessoal: boolean
  usuario_id?: string | null
  created_at: string
  updated_at: string
  categoria?: Categoria | null
}

export interface NotificacaoLog {
  id: string
  tipo: string
  destinatario_telefone: string
  destinatario_nome?: string | null
  mensagem: string
  status: 'enviado' | 'entregue' | 'lido' | 'erro' | 'pendente'
  erro_detalhes?: string | null
  cobranca_id?: string | null
  usuario_id?: string | null
  created_at: string
}

export interface CentroCusto {
  id: string
  nome: string
  descricao?: string | null
  franquia_id?: string | null
  ativo: boolean
  created_at: string
}

export interface DRE {
  id: string
  mes: number
  ano: number
  franquia_id?: string | null
  is_pessoal: boolean
  receita_bruta: number
  deducoes: number
  receita_liquida: number
  custos: number
  lucro_bruto: number
  despesas_operacionais: number
  resultado_operacional: number
  resultado_liquido: number
  dados_detalhados: Record<string, unknown>
  usuario_id?: string | null
  created_at: string
  updated_at: string
}

export interface FluxoCaixa {
  id: string
  data_referencia: string
  saldo_inicial: number
  entradas: number
  saidas: number
  saldo_final: number
  franquia_id?: string | null
  is_pessoal: boolean
  is_projecao: boolean
  usuario_id?: string | null
  created_at: string
}

// Database type for Supabase client
export interface Database {
  public: {
    Tables: {
      _financeiro_usuarios: { Row: Usuario; Insert: Partial<Usuario>; Update: Partial<Usuario> }
      _financeiro_franquias: { Row: Franquia; Insert: Partial<Franquia>; Update: Partial<Franquia> }
      _financeiro_categorias: { Row: Categoria; Insert: Partial<Categoria>; Update: Partial<Categoria> }
      _financeiro_contas_bancarias: { Row: ContaBancaria; Insert: Partial<ContaBancaria>; Update: Partial<ContaBancaria> }
      _financeiro_transacoes: { Row: Transacao; Insert: Partial<Transacao>; Update: Partial<Transacao> }
      _financeiro_cobrancas: { Row: Cobranca; Insert: Partial<Cobranca>; Update: Partial<Cobranca> }
      _financeiro_centros_custo: { Row: CentroCusto; Insert: Partial<CentroCusto>; Update: Partial<CentroCusto> }
      _financeiro_orcamentos: { Row: Orcamento; Insert: Partial<Orcamento>; Update: Partial<Orcamento> }
      _financeiro_integracoes: { Row: Integracao; Insert: Partial<Integracao>; Update: Partial<Integracao> }
      _financeiro_notificacoes_log: { Row: NotificacaoLog; Insert: Partial<NotificacaoLog>; Update: Partial<NotificacaoLog> }
      _financeiro_dre: { Row: DRE; Insert: Partial<DRE>; Update: Partial<DRE> }
      _financeiro_fluxo_caixa: { Row: FluxoCaixa; Insert: Partial<FluxoCaixa>; Update: Partial<FluxoCaixa> }
    }
    Views: {
      _financeiro_view_resumo_franquia: {
        Row: {
          franquia_id: string
          franquia_nome: string
          total_receitas: number
          total_despesas: number
          saldo: number
          pendentes: number
          atrasados: number
        }
      }
    }
  }
}
