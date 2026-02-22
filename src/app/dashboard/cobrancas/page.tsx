'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, X, Bell, Phone, Mail, AlertTriangle, Clock, CheckCircle, Send } from 'lucide-react'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, diasParaVencer } from '@/lib/utils'
import type { Cobranca, Franquia } from '@/types/database'

export default function CobrancasPage() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([])
  const [franquias, setFranquias] = useState<Franquia[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filtros, setFiltros] = useState({ tipo: '', status: '', search: '' })
  const [sendingWhatsapp, setSendingWhatsapp] = useState<string | null>(null)
  const [form, setForm] = useState({
    tipo: 'receber' as string, descricao: '', valor: '', data_vencimento: '',
    nome_contato: '', telefone_contato: '', email_contato: '', cpf_cnpj_contato: '',
    notificar_whatsapp: true, dias_antes_notificar: 3, franquia_id: '', is_pessoal: false,
    observacoes: '', link_pagamento: '',
  })

  useEffect(() => {
    fetchCobrancas()
    fetchFranquias()
  }, [])

  const fetchCobrancas = async () => {
    try {
      const params = new URLSearchParams()
      if (filtros.tipo) params.set('tipo', filtros.tipo)
      if (filtros.status) params.set('status', filtros.status)
      const res = await fetch(`/api/cobrancas?${params}`)
      const data = await res.json()
      setCobrancas(Array.isArray(data) ? data : [])
    } catch { setCobrancas([]) }
    finally { setLoading(false) }
  }

  const fetchFranquias = async () => {
    const res = await fetch('/api/franquias')
    const data = await res.json()
    setFranquias(Array.isArray(data) ? data.filter((f: Franquia) => f.ativa) : [])
  }

  useEffect(() => { fetchCobrancas() }, [filtros.tipo, filtros.status])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/cobrancas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, valor: parseFloat(form.valor) }),
    })
    setShowModal(false)
    fetchCobrancas()
  }

  const handlePagar = async (id: string) => {
    await fetch(`/api/cobrancas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] }),
    })
    fetchCobrancas()
  }

  const handleSendWhatsapp = async (cobranca: Cobranca) => {
    if (!cobranca.telefone_contato) return alert('Contato sem telefone cadastrado')
    setSendingWhatsapp(cobranca.id)
    
    const valorFormatado = formatCurrency(Number(cobranca.valor))
    const dataFormatada = formatDate(cobranca.data_vencimento)
    const mensagem = cobranca.tipo === 'receber'
      ? `📋 *COBRANÇA*\n\nOlá${cobranca.nome_contato ? ' ' + cobranca.nome_contato : ''}!\n\nRef: *${cobranca.descricao}*\nValor: *${valorFormatado}*\nVencimento: *${dataFormatada}*\n\n${cobranca.link_pagamento ? '🔗 Pague aqui: ' + cobranca.link_pagamento + '\n\n' : ''}_FinanceFlow_`
      : `🟡 *LEMBRETE*\n\n*${cobranca.descricao}*\nValor: *${valorFormatado}*\nVencimento: *${dataFormatada}*`

    try {
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: cobranca.telefone_contato, mensagem, nome: cobranca.nome_contato }),
      })
      alert('Mensagem enviada com sucesso!')
    } catch { alert('Erro ao enviar mensagem') }
    finally { setSendingWhatsapp(null) }
  }

  const handleCheckCobrancas = async () => {
    const res = await fetch('/api/whatsapp/check-cobrancas', { method: 'POST' })
    const result = await res.json()
    alert(result.message || 'Verificação concluída')
  }

  const filtered = cobrancas.filter(c =>
    !filtros.search || c.descricao.toLowerCase().includes(filtros.search.toLowerCase()) || c.nome_contato?.toLowerCase().includes(filtros.search.toLowerCase())
  )

  const totalReceber = filtered.filter(c => c.tipo === 'receber' && c.status !== 'pago' && c.status !== 'cancelado').reduce((s, c) => s + Number(c.valor), 0)
  const totalPagar = filtered.filter(c => c.tipo === 'pagar' && c.status !== 'pago' && c.status !== 'cancelado').reduce((s, c) => s + Number(c.valor), 0)
  const atrasadas = filtered.filter(c => c.status === 'atrasado').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cobranças</h1>
          <p className="text-gray-500 text-sm mt-1">Contas a receber e a pagar com notificação WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCheckCobrancas} className="btn-secondary flex items-center gap-2 text-sm">
            <Bell className="w-4 h-4" /> Verificar Cobranças
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Cobrança
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 border border-emerald-500/20">
          <p className="text-xs text-gray-500 mb-1">A Receber</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalReceber)}</p>
        </div>
        <div className="glass-card p-4 border border-red-500/20">
          <p className="text-xs text-gray-500 mb-1">A Pagar</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(totalPagar)}</p>
        </div>
        <div className="glass-card p-4 border border-amber-500/20">
          <p className="text-xs text-gray-500 mb-1">Atrasadas</p>
          <p className="text-xl font-bold text-amber-400">{atrasadas}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={filtros.search} onChange={(e) => setFiltros({...filtros, search: e.target.value})} placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 text-sm" />
        </div>
        <select value={filtros.tipo} onChange={(e) => setFiltros({...filtros, tipo: e.target.value})} className="px-3 py-2 text-sm">
          <option value="">Todos</option>
          <option value="receber">A Receber</option>
          <option value="pagar">A Pagar</option>
        </select>
        <select value={filtros.status} onChange={(e) => setFiltros({...filtros, status: e.target.value})} className="px-3 py-2 text-sm">
          <option value="">Todos Status</option>
          <option value="pendente">Pendente</option>
          <option value="atrasado">Atrasado</option>
          <option value="pago">Pago</option>
        </select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="glass-card h-24 shimmer" />)
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhuma cobrança encontrada</p>
          </div>
        ) : (
          filtered.map((c) => {
            const dias = diasParaVencer(c.data_vencimento)
            return (
              <div key={c.id} className="glass-card p-4 hover:border-indigo-500/20 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      c.status === 'atrasado' ? 'bg-red-500/10' : c.status === 'pago' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                    }`}>
                      {c.status === 'atrasado' ? <AlertTriangle className="w-5 h-5 text-red-400" /> :
                       c.status === 'pago' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> :
                       <Clock className="w-5 h-5 text-amber-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200">{c.descricao}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(c.status)}`}>
                          {getStatusLabel(c.status)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.tipo === 'receber' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {c.tipo === 'receber' ? 'Receber' : 'Pagar'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {c.nome_contato && <span>{c.nome_contato}</span>}
                        <span>Vencimento: {formatDate(c.data_vencimento)}</span>
                        {dias < 0 && c.status !== 'pago' && <span className="text-red-400">{Math.abs(dias)} dias atrasado</span>}
                        {dias >= 0 && dias <= 3 && c.status === 'pendente' && <span className="text-amber-400">Vence em {dias} dias</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${c.tipo === 'receber' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(Number(c.valor))}
                    </span>
                    <div className="flex gap-1">
                      {c.status !== 'pago' && (
                        <button onClick={() => handlePagar(c.id)} className="p-2 rounded-lg hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 transition-colors" title="Marcar como pago">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {c.telefone_contato && c.status !== 'pago' && (
                        <button onClick={() => handleSendWhatsapp(c)} disabled={sendingWhatsapp === c.id} className="p-2 rounded-lg hover:bg-green-500/10 text-gray-400 hover:text-green-400 transition-colors" title="Enviar WhatsApp">
                          {sendingWhatsapp === c.id ? <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Nova Cobrança</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({...form, tipo: 'receber'})} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${form.tipo === 'receber' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'border-[#2a2a3a] text-gray-400'}`}>A Receber</button>
                <button type="button" onClick={() => setForm({...form, tipo: 'pagar'})} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${form.tipo === 'pagar' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'border-[#2a2a3a] text-gray-400'}`}>A Pagar</button>
              </div>

              <div><label className="block text-xs text-gray-400 mb-1">Descrição *</label><input type="text" value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
              
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Valor *</label><input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({...form, valor: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Vencimento *</label><input type="date" value={form.data_vencimento} onChange={(e) => setForm({...form, data_vencimento: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
              </div>

              <div className="border-t border-[#2a2a3a] pt-4">
                <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Dados do Contato</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs text-gray-400 mb-1">Nome</label><input type="text" value={form.nome_contato} onChange={(e) => setForm({...form, nome_contato: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                  <div><label className="block text-xs text-gray-400 mb-1">Telefone (WhatsApp)</label><input type="text" value={form.telefone_contato} onChange={(e) => setForm({...form, telefone_contato: e.target.value})} className="w-full px-3 py-2 text-sm" placeholder="(00) 00000-0000" /></div>
                  <div><label className="block text-xs text-gray-400 mb-1">Email</label><input type="email" value={form.email_contato} onChange={(e) => setForm({...form, email_contato: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                  <div><label className="block text-xs text-gray-400 mb-1">CPF/CNPJ</label><input type="text" value={form.cpf_cnpj_contato} onChange={(e) => setForm({...form, cpf_cnpj_contato: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Franquia</label>
                  <select value={form.franquia_id} onChange={(e) => setForm({...form, franquia_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="">Nenhuma</option>
                    {franquias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Dias antes p/ notificar</label>
                  <input type="number" min="0" max="30" value={form.dias_antes_notificar} onChange={(e) => setForm({...form, dias_antes_notificar: parseInt(e.target.value)})} className="w-full px-3 py-2 text-sm" />
                </div>
              </div>

              <div><label className="block text-xs text-gray-400 mb-1">Link de Pagamento</label><input type="url" value={form.link_pagamento} onChange={(e) => setForm({...form, link_pagamento: e.target.value})} className="w-full px-3 py-2 text-sm" placeholder="https://..." /></div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={form.notificar_whatsapp} onChange={(e) => setForm({...form, notificar_whatsapp: e.target.checked})} className="w-4 h-4 rounded" />
                  Notificar via WhatsApp
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={form.is_pessoal} onChange={(e) => setForm({...form, is_pessoal: e.target.checked})} className="w-4 h-4 rounded" />
                  Pessoal
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm">Criar Cobrança</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
