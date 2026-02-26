// ============================================================
// C6 BANK - API Client
// Integração completa: Auth, PIX, Boleto, Checkout, Extrato, DDA
// ============================================================

const C6_SANDBOX_URL = 'https://baas-api-sandbox.c6bank.info'
const C6_PRODUCTION_URL = 'https://baas-api.c6bank.info'

interface C6TokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface C6Config {
  clientId: string
  clientSecret: string
  pixKey?: string
  ambiente: 'sandbox' | 'producao'
  webhookUrl?: string
}

// ---- Cache de Token ----
let cachedToken: { token: string; expiresAt: number } | null = null

function getBaseUrl(ambiente: 'sandbox' | 'producao') {
  return ambiente === 'producao' ? C6_PRODUCTION_URL : C6_SANDBOX_URL
}

// ---- AUTENTICAÇÃO ----
export async function c6Authenticate(config: C6Config): Promise<C6TokenResponse> {
  // Verificar cache
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return { access_token: cachedToken.token, expires_in: Math.floor((cachedToken.expiresAt - Date.now()) / 1000), token_type: 'Bearer' }
  }

  const baseUrl = getBaseUrl(config.ambiente)
  const res = await fetch(`${baseUrl}/v1/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`C6 Auth falhou (${res.status}): ${err}`)
  }

  const data: C6TokenResponse = await res.json()
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return data
}

async function c6Request(config: C6Config, method: string, path: string, body?: unknown) {
  const auth = await c6Authenticate(config)
  const baseUrl = getBaseUrl(config.ambiente)
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${auth.access_token}`,
    'Content-Type': 'application/json',
    'partner-software-name': 'FarolFinance',
    'partner-software-version': '1.0',
  }
  const opts: RequestInit = { method, headers }
  if (body && method !== 'GET') opts.body = JSON.stringify(body)
  const res = await fetch(`${baseUrl}${path}`, opts)
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok) throw new Error(JSON.stringify({ status: res.status, ...json }))
  return json
}

// ---- PIX - Cobrança Imediata ----
export async function c6PixCriarCobranca(config: C6Config, dados: {
  valor: string
  cpf?: string
  nome?: string
  descricao?: string
  expiracao?: number
}) {
  const payload: Record<string, unknown> = {
    calendario: { expiracao: dados.expiracao || 3600 },
    valor: { original: dados.valor },
    chave: config.pixKey || '',
    solicitacaoPagador: dados.descricao || 'Pagamento via Farol Finance',
  }
  if (dados.cpf && dados.nome) {
    payload.devedor = { cpf: dados.cpf, nome: dados.nome }
  }
  return c6Request(config, 'POST', '/v2/pix/cob', payload)
}

export async function c6PixConsultarCobranca(config: C6Config, txid: string) {
  return c6Request(config, 'GET', `/v2/pix/cob/${txid}`)
}

export async function c6PixListarCobrancas(config: C6Config, inicio: string, fim: string) {
  return c6Request(config, 'GET', `/v2/pix/cob?inicio=${inicio}&fim=${fim}`)
}

export async function c6PixAtualizarCobranca(config: C6Config, txid: string, dados: Record<string, unknown>) {
  return c6Request(config, 'PATCH', `/v2/pix/cob/${txid}`, dados)
}

// ---- PIX - Cobrança com Vencimento ----
export async function c6PixCriarCobV(config: C6Config, txid: string, dados: {
  valor: string
  cpf: string
  nome: string
  vencimento: string
  descricao?: string
}) {
  return c6Request(config, 'PUT', `/v2/pix/cobv/${txid}`, {
    calendario: { dataDeVencimento: dados.vencimento },
    devedor: { cpf: dados.cpf, nome: dados.nome },
    valor: { original: dados.valor },
    chave: config.pixKey || '',
    solicitacaoPagador: dados.descricao || 'Cobrança com vencimento',
  })
}

export async function c6PixConsultarCobV(config: C6Config, txid: string) {
  return c6Request(config, 'GET', `/v2/pix/cobv/${txid}`)
}

// ---- PIX - Webhook ----
export async function c6PixConfigWebhook(config: C6Config, webhookUrl: string) {
  if (!config.pixKey) throw new Error('Chave PIX não configurada')
  return c6Request(config, 'PUT', `/v2/pix/webhook/${config.pixKey}`, { webhookUrl })
}

export async function c6PixConsultarWebhook(config: C6Config) {
  if (!config.pixKey) throw new Error('Chave PIX não configurada')
  return c6Request(config, 'GET', `/v2/pix/webhook/${config.pixKey}`)
}

export async function c6PixDeletarWebhook(config: C6Config) {
  if (!config.pixKey) throw new Error('Chave PIX não configurada')
  return c6Request(config, 'DELETE', `/v2/pix/webhook/${config.pixKey}`)
}

// ---- BOLETO ----
export async function c6BoletoEmitir(config: C6Config, dados: {
  valor: number
  vencimento: string
  pagador: {
    nome: string
    cpf_cnpj: string
    email?: string
    endereco?: { rua: string; numero: number; complemento?: string; cidade: string; estado: string; cep: string }
  }
  referencia?: string
  instrucoes?: string[]
  juros?: { tipo: string; valor: number }
  multa?: { tipo: string; valor: number }
  desconto?: { tipo: string; valor: number; prazo: number }
}) {
  const payload: Record<string, unknown> = {
    external_reference_id: dados.referencia || `FF-${Date.now()}`,
    amount: dados.valor,
    due_date: dados.vencimento,
    payer: {
      name: dados.pagador.nome,
      tax_id: dados.pagador.cpf_cnpj.replace(/\D/g, ''),
      email: dados.pagador.email || '',
      address: dados.pagador.endereco ? {
        street: dados.pagador.endereco.rua,
        number: dados.pagador.endereco.numero,
        complement: dados.pagador.endereco.complemento || '',
        city: dados.pagador.endereco.cidade,
        state: dados.pagador.endereco.estado,
        zip_code: dados.pagador.endereco.cep.replace(/\D/g, ''),
      } : {
        street: 'Não informado',
        number: 0,
        complement: '',
        city: 'Não informado',
        state: 'SP',
        zip_code: '00000000',
      },
    },
  }
  if (dados.instrucoes) payload.instructions = dados.instrucoes
  if (dados.juros) payload.interest = { type: dados.juros.tipo, value: dados.juros.valor, dead_line: 0 }
  if (dados.multa) payload.fine = { type: dados.multa.tipo, value: dados.multa.valor, dead_line: 0 }
  if (dados.desconto) payload.discount = { discount_type: dados.desconto.tipo, first: { value: dados.desconto.valor, dead_line: dados.desconto.prazo } }
  return c6Request(config, 'POST', '/v1/bank_slips', payload)
}

export async function c6BoletoConsultar(config: C6Config, id: string) {
  return c6Request(config, 'GET', `/v1/bank_slips/${id}`)
}

export async function c6BoletoPDF(config: C6Config, id: string) {
  return c6Request(config, 'GET', `/v1/bank_slips/${id}/pdf`)
}

export async function c6BoletoCancelar(config: C6Config, id: string) {
  return c6Request(config, 'PUT', `/v1/bank_slips/${id}/cancel`)
}

export async function c6BoletoAlterar(config: C6Config, id: string, dados: Record<string, unknown>) {
  return c6Request(config, 'PUT', `/v1/bank_slips/${id}`, dados)
}

// ---- CHECKOUT (Link de Pagamento / C6 Pay) ----
export async function c6CheckoutCriar(config: C6Config, dados: {
  valor: number
  descricao: string
  referencia?: string
  pagador: { nome: string; cpf_cnpj: string; email: string }
  redirectUrl?: string
}) {
  return c6Request(config, 'POST', '/v1/checkouts', {
    amount: dados.valor,
    description: dados.descricao,
    external_reference_id: dados.referencia || `FF-CHK-${Date.now()}`,
    payer: {
      name: dados.pagador.nome,
      tax_id: dados.pagador.cpf_cnpj.replace(/\D/g, ''),
      email: dados.pagador.email,
    },
    payment: { pix: { key: 'AUTO' } },
    redirect_url: dados.redirectUrl || '',
  })
}

export async function c6CheckoutConsultar(config: C6Config, id: string) {
  return c6Request(config, 'GET', `/v1/checkouts/${id}`)
}

export async function c6CheckoutCancelar(config: C6Config, id: string) {
  return c6Request(config, 'PUT', `/v1/checkouts/${id}/cancel`)
}

// ---- EXTRATO ----
export async function c6ExtratoConsultar(config: C6Config, startDate: string, endDate: string, page = 1) {
  return c6Request(config, 'GET', `/v1/statement?start_date=${startDate}&end_date=${endDate}&page=${page}`)
}

// ---- SALDO / CONTA ----
export async function c6ContaConsultar(config: C6Config) {
  return c6Request(config, 'GET', '/accounts')
}

// ---- DDA / PAGAMENTOS AGENDADOS ----
export async function c6DDAConsultar(config: C6Config) {
  return c6Request(config, 'GET', '/v1/schedule_payments/query')
}

export async function c6DDADecodificar(config: C6Config, items: Array<{
  content: string
  amount: number
  transaction_date: string
}>) {
  return c6Request(config, 'POST', '/v1/schedule_payments/decode', { items })
}

// ---- WEBHOOKS BANCÁRIOS ----
export async function c6WebhookRegistrar(config: C6Config, service: 'BANK_SLIP' | 'CHECKOUT', url: string) {
  return c6Request(config, 'POST', '/v1/webhooks', { service, url })
}

export async function c6WebhookListar(config: C6Config, service: 'BANK_SLIP' | 'CHECKOUT') {
  return c6Request(config, 'GET', `/v1/webhooks?service=${service}`)
}

export async function c6WebhookDeletar(config: C6Config, service: 'BANK_SLIP' | 'CHECKOUT') {
  return c6Request(config, 'DELETE', `/v1/webhooks?service=${service}`)
}

// ---- C6 PAY (Adquirência) ----
export async function c6PayRecebiveis(config: C6Config, startDate: string, page = 1) {
  return c6Request(config, 'GET', `/v1/c6pay/statement/receivables?start_date=${startDate}&page=${page}`)
}

export async function c6PayTransacoes(config: C6Config, startDate: string, page = 1) {
  return c6Request(config, 'GET', `/v1/c6pay/statement/transactions?start_date=${startDate}&page=${page}`)
}

// ---- HELPER: Construir config a partir da integração DB ----
export function buildC6Config(integracao: {
  api_key?: string | null
  api_secret?: string | null
  access_token?: string | null
  webhook_url?: string | null
  ambiente: string
  configuracoes_extra?: Record<string, unknown> | null
}): C6Config {
  return {
    clientId: integracao.api_key || '',
    clientSecret: integracao.api_secret || '',
    pixKey: (integracao.configuracoes_extra?.pix_key as string) || integracao.access_token || '',
    ambiente: integracao.ambiente === 'producao' ? 'producao' : 'sandbox',
    webhookUrl: integracao.webhook_url || '',
  }
}
