'use client'

import { useState, useEffect } from 'react'
import { Globe, Plus, Key, Eye, EyeOff, Check, X, AlertCircle, Zap, CreditCard } from 'lucide-react'
import type { Integracao, Franquia } from '@/types/database'

const PROVEDORES = [
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

export default function IntegracoesPage() {
  const [integracoes, setIntegracoes] = useState<Integracao[]>([])
  const [franquias, setFranquias] = useState<Franquia[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: '', provedor: '', api_key: '', api_secret: '', access_token: '',
    webhook_url: '', ambiente: 'sandbox', franquia_id: '',
    cert_pem: '', key_pem: '',
  })

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
    const res = await fetch('/api/franquias')
    const data = await res.json()
    setFranquias(Array.isArray(data) ? data.filter((f: Franquia) => f.ativa) : [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    // Limpar campos vazios para null e adicionar defaults
    const payload: Record<string, unknown> = {
      nome: form.nome,
      provedor: form.provedor,
      ambiente: form.ambiente,
      franquia_id: form.franquia_id || null,
      api_key: form.api_key || null,
      api_secret: form.api_secret || null,
      access_token: form.access_token || null,
      webhook_url: form.webhook_url || null,
      ativa: true,
      configuracoes_extra: form.provedor === 'c6bank' ? {
        cert_pem: form.cert_pem || null,
        key_pem: form.key_pem || null,
        pix_key: form.access_token || null,
      } : {},
    }

    try {
      const res = await fetch('/api/integracoes', {
        method: 'POST',
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
      setForm({ nome: '', provedor: '', api_key: '', api_secret: '', access_token: '', webhook_url: '', ambiente: 'sandbox', franquia_id: '', cert_pem: '', key_pem: '' })
      fetchIntegracoes()
    } catch {
      setFormError('Erro de conexão. Tente novamente.')
    }
    setSubmitting(false)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Integrações</h1>
          <p className="text-gray-500 text-sm mt-1">Conecte seus gateways de pagamento e bancos</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Integração
        </button>
      </div>

      {/* Active Integrations */}
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
            return (
              <div key={integ.id} className="glass-card p-5 hover:border-indigo-500/20 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
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
                  </div>
                </div>
                <div className="space-y-2">
                  {integ.api_key && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">API Key:</span>
                      <div className="flex items-center gap-1">
                        <code className="text-gray-400 font-mono">{showKeys[integ.id] ? integ.api_key : maskKey(integ.api_key)}</code>
                        <button onClick={() => setShowKeys({...showKeys, [integ.id]: !showKeys[integ.id]})} className="text-gray-500 hover:text-gray-300">
                          {showKeys[integ.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}
                  {integ.webhook_url && <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Webhook:</span><span className="text-gray-400 truncate max-w-[200px]">{integ.webhook_url}</span></div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Available Providers */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Provedores Disponíveis</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {PROVEDORES.map((p) => {
            const connected = integracoes.some(i => i.provedor === p.id && i.ativa)
            return (
              <div key={p.id} className={`glass-card p-4 text-center group cursor-pointer hover:border-indigo-500/20 transition-all ${connected ? 'border-emerald-500/20' : ''}`}
                onClick={() => { setForm({...form, provedor: p.id, nome: p.nome}); setShowModal(true) }}>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Configurar Integração</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {formError}
                </div>
              )}
              {form.provedor === 'c6bank' && (
                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                  <strong>C6 Bank:</strong> API Key = Client ID | API Secret = Client Secret | Access Token = Chave PIX<br />
                  <strong>mTLS obrigatório:</strong> Cole o conteúdo dos arquivos .crt e .key nos campos abaixo.
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Nome</label><input type="text" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Provedor</label>
                  <select value={form.provedor} onChange={(e) => setForm({...form, provedor: e.target.value})} className="w-full px-3 py-2 text-sm" required>
                    <option value="">Selecione</option>
                    {PROVEDORES.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-xs text-gray-400 mb-1">{form.provedor === 'c6bank' ? 'Client ID (API Key)' : 'API Key'}</label><input type="text" value={form.api_key} onChange={(e) => setForm({...form, api_key: e.target.value})} className="w-full px-3 py-2 text-sm font-mono" /></div>
              <div><label className="block text-xs text-gray-400 mb-1">{form.provedor === 'c6bank' ? 'Client Secret (API Secret)' : 'API Secret'}</label><input type="text" value={form.api_secret} onChange={(e) => setForm({...form, api_secret: e.target.value})} className="w-full px-3 py-2 text-sm font-mono" /></div>
              <div><label className="block text-xs text-gray-400 mb-1">{form.provedor === 'c6bank' ? 'Chave PIX (Access Token)' : 'Access Token'}</label><input type="text" value={form.access_token} onChange={(e) => setForm({...form, access_token: e.target.value})} className="w-full px-3 py-2 text-sm font-mono" /></div>
              <div><label className="block text-xs text-gray-400 mb-1">Webhook URL</label><input type="url" value={form.webhook_url} onChange={(e) => setForm({...form, webhook_url: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
              {form.provedor === 'c6bank' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Certificado mTLS (.crt) — conteúdo PEM</label>
                    <textarea value={form.cert_pem} onChange={(e) => setForm({...form, cert_pem: e.target.value})} className="w-full px-3 py-2 text-xs font-mono h-24 resize-y" placeholder={"-----BEGIN CERTIFICATE-----\n...conteúdo do arquivo .crt...\n-----END CERTIFICATE-----"} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Chave Privada mTLS (.key) — conteúdo PEM</label>
                    <textarea value={form.key_pem} onChange={(e) => setForm({...form, key_pem: e.target.value})} className="w-full px-3 py-2 text-xs font-mono h-24 resize-y" placeholder={"-----BEGIN PRIVATE KEY-----\n...conteúdo do arquivo .key...\n-----END PRIVATE KEY-----"} />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Ambiente</label>
                  <select value={form.ambiente} onChange={(e) => setForm({...form, ambiente: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="sandbox">Sandbox (Teste)</option>
                    <option value="producao">Produção</option>
                  </select>
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Franquia</label>
                  <select value={form.franquia_id} onChange={(e) => setForm({...form, franquia_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="">Global</option>
                    {franquias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setFormError(null) }} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 text-sm disabled:opacity-50">
                  {submitting ? 'Salvando...' : 'Salvar Integração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
