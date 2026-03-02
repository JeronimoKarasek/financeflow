'use client'

import { useState, useEffect, useMemo } from 'react'
import { Globe, Plus, Eye, EyeOff, Check, X, Trash2 } from 'lucide-react'
import type { Integracao, Franquia } from '@/types/database'

// ========== PROVEDORES ==========
const PROVEDORES = [
  { id: 'openai', nome: 'OpenAI', cor: '#10a37f', desc: 'IA: Categorização, Consultor, Insights, Relatórios' },
  { id: 'asaas', nome: 'Asaas', cor: '#0066FF', desc: 'Cobranças, boletos e PIX' },
  { id: 'stripe', nome: 'Stripe', cor: '#635BFF', desc: 'Pagamentos internacionais' },
  { id: 'mercado_pago', nome: 'Mercado Pago', cor: '#009EE3', desc: 'Pagamentos e QR Code' },
  { id: 'hotmart', nome: 'Hotmart', cor: '#F04E23', desc: 'Produtos digitais' },
  { id: 'evolution_api', nome: 'Evolution API', cor: '#25D366', desc: 'WhatsApp automático' },
  { id: 'banco_do_brasil', nome: 'Banco do Brasil', cor: '#FFEF00', desc: 'Integração bancária' },
  { id: 'itau', nome: 'Itaú', cor: '#FF6600', desc: 'Integração bancária' },
  { id: 'bradesco', nome: 'Bradesco', cor: '#CC092F', desc: 'Integração bancária' },
  { id: 'santander', nome: 'Santander', cor: '#EC0000', desc: 'Integração bancária' },
  { id: 'nubank', nome: 'Nubank', cor: '#820AD1', desc: 'Integração bancária' },
  { id: 'inter', nome: 'Inter', cor: '#FF7A00', desc: 'Integração bancária' },
  { id: 'sicoob', nome: 'Sicoob', cor: '#003641', desc: 'Cooperativa de crédito' },
  { id: 'caixa', nome: 'Caixa', cor: '#005CA9', desc: 'Integração bancária' },
  { id: 'c6bank', nome: 'C6 Bank', cor: '#242424', desc: 'PIX, Boletos, Checkout, DDA, Extrato' },
  { id: 'stone', nome: 'Stone', cor: '#00A868', desc: 'Pagamentos' },
  { id: 'pagseguro', nome: 'PagSeguro', cor: '#FFC800', desc: 'Pagamentos' },
]

// ========== CAMPOS POR PROVEDOR ==========
// storage: onde salvar no payload ('api_key' | 'api_secret' | 'access_token' | 'webhook_url' | 'extra' → configuracoes_extra)
interface FieldDef {
  key: string
  label: string
  placeholder?: string
  type: 'text' | 'url' | 'email' | 'textarea'
  storage: 'api_key' | 'api_secret' | 'access_token' | 'webhook_url' | 'extra'
  required?: boolean
}

const BANK_FIELDS: FieldDef[] = [
  { key: 'api_key', label: 'Client ID', placeholder: 'Client ID do banco', type: 'text', storage: 'api_key', required: true },
  { key: 'api_secret', label: 'Client Secret', placeholder: 'Client Secret do banco', type: 'text', storage: 'api_secret', required: true },
  { key: 'cert_pem', label: 'Certificado (.crt) — PEM', placeholder: '-----BEGIN CERTIFICATE-----\n...conteúdo...\n-----END CERTIFICATE-----', type: 'textarea', storage: 'extra' },
  { key: 'key_pem', label: 'Chave Privada (.key) — PEM', placeholder: '-----BEGIN PRIVATE KEY-----\n...conteúdo...\n-----END PRIVATE KEY-----', type: 'textarea', storage: 'extra' },
  { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://...', type: 'url', storage: 'webhook_url' },
]

const PROVIDER_FIELDS: Record<string, FieldDef[]> = {
  openai: [
    { key: 'api_key', label: 'API Key', placeholder: 'sk-...', type: 'text', storage: 'api_key', required: true },
    { key: 'model', label: 'Modelo padrão', placeholder: 'gpt-4o-mini', type: 'text', storage: 'extra' },
  ],
  evolution_api: [
    { key: 'api_url', label: 'URL da Instância', placeholder: 'https://evolution.seudominio.com', type: 'url', storage: 'extra', required: true },
    { key: 'api_key', label: 'Global API Key', placeholder: 'Chave global da Evolution API', type: 'text', storage: 'api_key', required: true },
    { key: 'instance_name', label: 'Nome da Instância', placeholder: 'farolfinance', type: 'text', storage: 'extra', required: true },
    { key: 'webhook_url', label: 'Webhook URL (opcional)', placeholder: 'https://...', type: 'url', storage: 'webhook_url' },
  ],
  asaas: [
    { key: 'api_key', label: 'API Key (Token)', placeholder: 'Token de acesso Asaas', type: 'text', storage: 'api_key', required: true },
    { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://...', type: 'url', storage: 'webhook_url' },
  ],
  stripe: [
    { key: 'api_key', label: 'Publishable Key', placeholder: 'pk_live_... ou pk_test_...', type: 'text', storage: 'api_key', required: true },
    { key: 'api_secret', label: 'Secret Key', placeholder: 'sk_live_... ou sk_test_...', type: 'text', storage: 'api_secret', required: true },
    { key: 'webhook_secret', label: 'Webhook Signing Secret', placeholder: 'whsec_...', type: 'text', storage: 'extra' },
    { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://...', type: 'url', storage: 'webhook_url' },
  ],
  mercado_pago: [
    { key: 'access_token', label: 'Access Token', placeholder: 'APP_USR-...', type: 'text', storage: 'access_token', required: true },
    { key: 'api_key', label: 'Public Key', placeholder: 'APP_USR-...', type: 'text', storage: 'api_key' },
    { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://...', type: 'url', storage: 'webhook_url' },
  ],
  hotmart: [
    { key: 'api_key', label: 'Hottok', placeholder: 'Token Hottok', type: 'text', storage: 'api_key', required: true },
    { key: 'client_id', label: 'Client ID', placeholder: 'Client ID Hotmart', type: 'text', storage: 'extra' },
    { key: 'api_secret', label: 'Client Secret', placeholder: 'Client Secret Hotmart', type: 'text', storage: 'api_secret' },
    { key: 'webhook_url', label: 'Webhook URL (Postback)', placeholder: 'https://...', type: 'url', storage: 'webhook_url' },
  ],
  c6bank: [
    { key: 'api_key', label: 'Client ID', placeholder: 'UUID do Client ID C6', type: 'text', storage: 'api_key', required: true },
    { key: 'api_secret', label: 'Client Secret', placeholder: 'Client Secret C6', type: 'text', storage: 'api_secret', required: true },
    { key: 'pix_key', label: 'Chave PIX', placeholder: 'UUID da chave PIX', type: 'text', storage: 'extra' },
    { key: 'cert_pem', label: 'Certificado mTLS (.crt) — PEM', placeholder: '-----BEGIN CERTIFICATE-----\n...conteúdo...\n-----END CERTIFICATE-----', type: 'textarea', storage: 'extra' },
    { key: 'key_pem', label: 'Chave Privada mTLS (.key) — PEM', placeholder: '-----BEGIN PRIVATE KEY-----\n...conteúdo...\n-----END PRIVATE KEY-----', type: 'textarea', storage: 'extra' },
    { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://...', type: 'url', storage: 'webhook_url' },
  ],
  stone: [
    { key: 'api_key', label: 'Stone Code', placeholder: 'Código Stone', type: 'text', storage: 'api_key', required: true },
    { key: 'api_secret', label: 'Secret Key', placeholder: 'Secret Key Stone', type: 'text', storage: 'api_secret' },
    { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://...', type: 'url', storage: 'webhook_url' },
  ],
  pagseguro: [
    { key: 'api_key', label: 'Token', placeholder: 'Token PagSeguro', type: 'text', storage: 'api_key', required: true },
    { key: 'email', label: 'Email PagSeguro', placeholder: 'email@exemplo.com', type: 'email', storage: 'extra' },
    { key: 'webhook_url', label: 'Webhook URL (Notificação)', placeholder: 'https://...', type: 'url', storage: 'webhook_url' },
  ],
  banco_do_brasil: BANK_FIELDS,
  itau: BANK_FIELDS,
  bradesco: BANK_FIELDS,
  santander: BANK_FIELDS,
  nubank: BANK_FIELDS,
  inter: BANK_FIELDS,
  sicoob: BANK_FIELDS,
  caixa: BANK_FIELDS,
}

const DEFAULT_FIELDS: FieldDef[] = [
  { key: 'api_key', label: 'API Key', type: 'text', storage: 'api_key', required: true },
  { key: 'api_secret', label: 'API Secret', type: 'text', storage: 'api_secret' },
  { key: 'access_token', label: 'Access Token', type: 'text', storage: 'access_token' },
  { key: 'webhook_url', label: 'Webhook URL', type: 'url', storage: 'webhook_url' },
]

const PROVIDER_HINTS: Record<string, string> = {
  openai: 'A API Key da OpenAI ativa todas as funcionalidades de IA: categorização automática, consultor financeiro via WhatsApp, insights, relatórios e análise preditiva. Modelo padrão: gpt-4o-mini (mais barato). Use gpt-4o para melhor qualidade.',
  evolution_api: 'Informe a URL da sua instância Evolution API, a API Key global e o nome da instância para conectar o WhatsApp.',
  c6bank: 'mTLS obrigatório: cole o conteúdo dos arquivos .crt e .key nos campos abaixo.',
  asaas: 'Use o token de acesso do painel Asaas (Configurações → Integrações → API).',
  stripe: 'Obtenha as chaves no Dashboard Stripe → Developers → API Keys.',
  mercado_pago: 'Access Token e Public Key disponíveis em Suas Integrações → Credenciais.',
  hotmart: 'Hottok disponível em Hotmart → Configurações → Webhooks (Notificações).',
}

export default function IntegracoesPage() {
  const [integracoes, setIntegracoes] = useState<Integracao[]>([])
  const [franquias, setFranquias] = useState<Franquia[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  const [formMeta, setFormMeta] = useState({ nome: '', provedor: '', ambiente: 'sandbox', franquia_id: '' })
  const [formFields, setFormFields] = useState<Record<string, string>>({})

  const activeFields = useMemo(() => {
    return PROVIDER_FIELDS[formMeta.provedor] || DEFAULT_FIELDS
  }, [formMeta.provedor])

  // Quando provedor muda, resetar campos
  useEffect(() => {
    if (!editId) {
      const fields: Record<string, string> = {}
      for (const f of (PROVIDER_FIELDS[formMeta.provedor] || DEFAULT_FIELDS)) {
        fields[f.key] = ''
      }
      setFormFields(fields)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formMeta.provedor])

  useEffect(() => {
    fetchIntegracoes()
    fetchFranquias()
  }, [])

  const fetchIntegracoes = async () => {
    try {
      const res = await fetch('/api/integracoes')
      const data = await res.json()
      setIntegracoes(Array.isArray(data) ? data : [])
    } catch { setIntegracoes([]) }
    finally { setLoading(false) }
  }

  const fetchFranquias = async () => {
    try {
      const res = await fetch('/api/franquias')
      const data = await res.json()
      setFranquias(Array.isArray(data) ? data.filter((f: Franquia) => f.ativa) : [])
    } catch { /* ignore */ }
  }

  const openNew = (provedorId?: string) => {
    const prov = PROVEDORES.find(p => p.id === provedorId)
    setFormMeta({ nome: prov?.nome || '', provedor: provedorId || '', ambiente: 'sandbox', franquia_id: '' })
    setFormFields({})
    setEditId(null)
    setFormError(null)
    setShowModal(true)
  }

  const openEdit = (integ: Integracao) => {
    setEditId(integ.id)
    setFormMeta({ nome: integ.nome, provedor: integ.provedor, ambiente: integ.ambiente, franquia_id: integ.franquia_id || '' })
    setFormError(null)

    const fields = PROVIDER_FIELDS[integ.provedor] || DEFAULT_FIELDS
    const vals: Record<string, string> = {}
    for (const f of fields) {
      if (f.storage === 'api_key') vals[f.key] = integ.api_key || ''
      else if (f.storage === 'api_secret') vals[f.key] = integ.api_secret || ''
      else if (f.storage === 'access_token') vals[f.key] = integ.access_token || ''
      else if (f.storage === 'webhook_url') vals[f.key] = integ.webhook_url || ''
      else if (f.storage === 'extra') vals[f.key] = String(integ.configuracoes_extra?.[f.key] ?? '')
    }
    setFormFields(vals)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    const payload: Record<string, unknown> = {
      nome: formMeta.nome,
      provedor: formMeta.provedor,
      ambiente: formMeta.ambiente,
      franquia_id: formMeta.franquia_id || null,
      ativa: true,
    }
    const extra: Record<string, unknown> = {}
    let apiKey: string | null = null
    let apiSecret: string | null = null
    let accessToken: string | null = null
    let webhookUrl: string | null = null

    for (const field of activeFields) {
      const val = formFields[field.key]?.trim() || null
      switch (field.storage) {
        case 'api_key': apiKey = val; break
        case 'api_secret': apiSecret = val; break
        case 'access_token': accessToken = val; break
        case 'webhook_url': webhookUrl = val; break
        case 'extra': if (val) extra[field.key] = val; break
      }
    }

    payload.api_key = apiKey
    payload.api_secret = apiSecret
    payload.access_token = accessToken
    payload.webhook_url = webhookUrl
    payload.configuracoes_extra = extra

    try {
      const method = editId ? 'PUT' : 'POST'
      if (editId) payload.id = editId

      const res = await fetch('/api/integracoes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Erro ao salvar integração')
        setSubmitting(false)
        return
      }
      setShowModal(false)
      fetchIntegracoes()
    } catch {
      setFormError('Erro de conexão. Tente novamente.')
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta integração?')) return
    try {
      await fetch('/api/integracoes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      fetchIntegracoes()
    } catch { /* ignore */ }
  }

  const toggleActive = async (integ: Integracao) => {
    await fetch('/api/integracoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: integ.id, ativa: !integ.ativa }),
    })
    fetchIntegracoes()
  }

  const maskKey = (key: string) => {
    if (!key) return '—'
    if (key.length <= 8) return '••••••••'
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4)
  }

  const getFieldDisplayLabel = (integ: Integracao) => {
    const fields = PROVIDER_FIELDS[integ.provedor] || DEFAULT_FIELDS
    const items: { label: string; value: string }[] = []
    for (const f of fields) {
      let val = ''
      if (f.storage === 'api_key') val = integ.api_key || ''
      else if (f.storage === 'api_secret') val = integ.api_secret || ''
      else if (f.storage === 'access_token') val = integ.access_token || ''
      else if (f.storage === 'webhook_url') val = integ.webhook_url || ''
      else if (f.storage === 'extra') val = String(integ.configuracoes_extra?.[f.key] ?? '')
      if (val && f.type !== 'textarea') items.push({ label: f.label, value: val })
    }
    return items.slice(0, 3)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Integrações</h1>
          <p className="text-gray-500 text-sm mt-1">Conecte seus gateways de pagamento, bancos e APIs</p>
        </div>
        <button onClick={() => openNew()} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Integração
        </button>
      </div>

      {/* Integrações Ativas */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="glass-card h-40 shimmer" />)}
        </div>
      ) : integracoes.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Globe className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhuma integração configurada</p>
          <p className="text-gray-600 text-sm mt-1">Conecte gateways de pagamento e bancos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integracoes.map((integ) => {
            const prov = PROVEDORES.find(p => p.id === integ.provedor)
            const displayFields = getFieldDisplayLabel(integ)
            return (
              <div key={integ.id} className="glass-card p-5 hover:border-indigo-500/20 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => openEdit(integ)}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: prov?.cor || '#6366f1' }}>
                      {(prov?.nome || integ.provedor).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{integ.nome}</h3>
                      <p className="text-xs text-gray-500">{prov?.desc || integ.provedor}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${integ.ambiente === 'producao' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {integ.ambiente === 'producao' ? 'Produção' : 'Sandbox'}
                    </span>
                    <button onClick={() => toggleActive(integ)} className={`w-10 h-5 rounded-full relative transition-colors ${integ.ativa ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${integ.ativa ? 'left-5' : 'left-0.5'}`} />
                    </button>
                    <button onClick={() => handleDelete(integ.id)} className="text-gray-500 hover:text-red-400 transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {displayFields.map((df, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{df.label}:</span>
                      <div className="flex items-center gap-1">
                        <code className="text-gray-400 font-mono text-[11px]">{showKeys[`${integ.id}_${i}`] ? df.value : maskKey(df.value)}</code>
                        <button onClick={() => setShowKeys(prev => ({...prev, [`${integ.id}_${i}`]: !prev[`${integ.id}_${i}`]}))} className="text-gray-500 hover:text-gray-300">
                          {showKeys[`${integ.id}_${i}`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Provedores Disponíveis */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Provedores Disponíveis</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {PROVEDORES.map((p) => {
            const connected = integracoes.some(i => i.provedor === p.id && i.ativa)
            return (
              <div key={p.id} className={`glass-card p-4 text-center group cursor-pointer hover:border-indigo-500/20 transition-all ${connected ? 'border-emerald-500/20' : ''}`}
                onClick={() => openNew(p.id)}>
                <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center text-white font-bold" style={{ backgroundColor: p.cor }}>
                  {p.nome.charAt(0)}
                </div>
                <p className="text-sm font-medium text-gray-200">{p.nome}</p>
                <p className="text-[10px] text-gray-500 mt-1">{p.desc}</p>
                {connected && <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-emerald-400"><Check className="w-3 h-3" /> Conectado</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* ======= MODAL ======= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editId ? 'Editar' : 'Nova'} Integração</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {formError}
                </div>
              )}

              {PROVIDER_HINTS[formMeta.provedor] && (
                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                  {PROVIDER_HINTS[formMeta.provedor]}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nome</label>
                  <input type="text" value={formMeta.nome} onChange={(e) => setFormMeta({...formMeta, nome: e.target.value})} className="w-full px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Provedor</label>
                  <select value={formMeta.provedor} onChange={(e) => setFormMeta({...formMeta, provedor: e.target.value})} className="w-full px-3 py-2 text-sm" required disabled={!!editId}>
                    <option value="">Selecione</option>
                    {PROVEDORES.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* Campos dinâmicos do provedor */}
              {formMeta.provedor && activeFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-400 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={formFields[field.key] || ''}
                      onChange={(e) => setFormFields({...formFields, [field.key]: e.target.value})}
                      className="w-full px-3 py-2 text-xs font-mono h-24 resize-y"
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  ) : (
                    <input
                      type={field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'}
                      value={formFields[field.key] || ''}
                      onChange={(e) => setFormFields({...formFields, [field.key]: e.target.value})}
                      className="w-full px-3 py-2 text-sm font-mono"
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  )}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ambiente</label>
                  <select value={formMeta.ambiente} onChange={(e) => setFormMeta({...formMeta, ambiente: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="sandbox">Sandbox (Teste)</option>
                    <option value="producao">Produção</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Franquia</label>
                  <select value={formMeta.franquia_id} onChange={(e) => setFormMeta({...formMeta, franquia_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="">Global</option>
                    {franquias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setFormError(null) }} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 text-sm disabled:opacity-50">
                  {submitting ? 'Salvando...' : editId ? 'Atualizar' : 'Salvar Integração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
