'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Filter, ArrowUpRight, ArrowDownRight, X, Calendar, Tag, Building2, Pencil, Trash2, MoreVertical, CreditCard } from 'lucide-react'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils'
import type { Transacao, Categoria, Franquia, ContaBancaria } from '@/types/database'

interface CartaoCredito {
  id: string
  nome: string
  bandeira: string
  banco: string | null
  ultimos_digitos: string | null
}

export default function TransacoesPage() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [franquias, setFranquias] = useState<Franquia[]>([])
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [filtros, setFiltros] = useState({ tipo: '', status: '', franquia_id: '', search: '' })
  const [form, setForm] = useState({
    tipo: 'despesa' as string, descricao: '', valor: '', data_vencimento: new Date().toISOString().split('T')[0],
    data_pagamento: '', status: 'pendente', categoria_id: '', conta_bancaria_id: '', franquia_id: '',
    cartao_credito_id: '', is_pessoal: false, recorrente: false, recorrencia_tipo: '', observacoes: '', parcela_total: 1,
  })

  useEffect(() => {
    Promise.all([fetchTransacoes(), fetchCategorias(), fetchFranquias(), fetchContas(), fetchCartoes()])
  }, [])

  const fetchTransacoes = async () => {
    try {
      const params = new URLSearchParams()
      if (filtros.tipo) params.set('tipo', filtros.tipo)
      if (filtros.status) params.set('status', filtros.status)
      if (filtros.franquia_id) params.set('franquia_id', filtros.franquia_id)
      const res = await fetch(`/api/transacoes?${params}`)
      const result = await res.json()
      setTransacoes(result.data || [])
    } catch { setTransacoes([]) }
    finally { setLoading(false) }
  }

  const fetchCategorias = async () => {
    const res = await fetch('/api/categorias')
    const data = await res.json()
    setCategorias(Array.isArray(data) ? data : [])
  }

  const fetchFranquias = async () => {
    const res = await fetch('/api/franquias')
    const data = await res.json()
    setFranquias(Array.isArray(data) ? data.filter((f: Franquia) => f.ativa) : [])
  }

  const fetchContas = async () => {
    const res = await fetch('/api/contas')
    const data = await res.json()
    setContas(Array.isArray(data) ? data : [])
  }

  const fetchCartoes = async () => {
    try {
      const res = await fetch('/api/cartoes')
      const data = await res.json()
      setCartoes(Array.isArray(data) ? data : [])
    } catch { setCartoes([]) }
  }

  useEffect(() => { fetchTransacoes() }, [filtros.tipo, filtros.status, filtros.franquia_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { ...form, valor: parseFloat(form.valor) }
    if (editingId) {
      await fetch(`/api/transacoes/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/transacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setShowModal(false)
    setEditingId(null)
    resetForm()
    fetchTransacoes()
  }

  const resetForm = () => setForm({
    tipo: 'despesa', descricao: '', valor: '', data_vencimento: new Date().toISOString().split('T')[0],
    data_pagamento: '', status: 'pendente', categoria_id: '', conta_bancaria_id: '', franquia_id: '',
    cartao_credito_id: '', is_pessoal: false, recorrente: false, recorrencia_tipo: '', observacoes: '', parcela_total: 1,
  })

  const handleEdit = (t: Transacao) => {
    setEditingId(t.id)
    setForm({
      tipo: t.tipo,
      descricao: t.descricao,
      valor: String(t.valor),
      data_vencimento: t.data_vencimento?.split('T')[0] || '',
      data_pagamento: t.data_pagamento?.split('T')[0] || '',
      status: t.status,
      categoria_id: t.categoria_id || '',
      conta_bancaria_id: t.conta_bancaria_id || '',
      franquia_id: t.franquia_id || '',
      cartao_credito_id: (t as Record<string, unknown>).cartao_credito_id as string || '',
      is_pessoal: t.is_pessoal || false,
      recorrente: t.recorrente || false,
      recorrencia_tipo: t.recorrencia_tipo || '',
      observacoes: t.observacoes || '',
      parcela_total: t.parcela_total || 1,
    })
    setShowModal(true)
    setActionMenu(null)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/transacoes/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    setActionMenu(null)
    fetchTransacoes()
  }

  const handleStatusChange = async (id: string, novoStatus: string) => {
    await fetch(`/api/transacoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: novoStatus,
        data_pagamento: novoStatus === 'pago' ? new Date().toISOString().split('T')[0] : null,
      }),
    })
    setActionMenu(null)
    fetchTransacoes()
  }

  const filtered = transacoes.filter(t =>
    !filtros.search || t.descricao.toLowerCase().includes(filtros.search.toLowerCase())
  )

  const totalReceitas = filtered.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0)
  const totalDespesas = filtered.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transações</h1>
          <p className="text-gray-500 text-sm mt-1">Receitas, despesas e transferências</p>
        </div>
        <button onClick={() => { resetForm(); setEditingId(null); setShowModal(true) }} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Transação
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 border border-emerald-500/20">
          <p className="text-xs text-gray-500 mb-1">Receitas</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalReceitas)}</p>
        </div>
        <div className="glass-card p-4 border border-red-500/20">
          <p className="text-xs text-gray-500 mb-1">Despesas</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(totalDespesas)}</p>
        </div>
        <div className="glass-card p-4 border border-indigo-500/20">
          <p className="text-xs text-gray-500 mb-1">Resultado</p>
          <p className={`text-xl font-bold ${totalReceitas - totalDespesas >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(totalReceitas - totalDespesas)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={filtros.search} onChange={(e) => setFiltros({...filtros, search: e.target.value})} placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 text-sm" />
        </div>
        <select value={filtros.tipo} onChange={(e) => setFiltros({...filtros, tipo: e.target.value})} className="px-3 py-2 text-sm min-w-[130px]">
          <option value="">Todos Tipos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
          <option value="transferencia">Transferências</option>
        </select>
        <select value={filtros.status} onChange={(e) => setFiltros({...filtros, status: e.target.value})} className="px-3 py-2 text-sm min-w-[130px]">
          <option value="">Todos Status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="atrasado">Atrasado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select value={filtros.franquia_id} onChange={(e) => setFiltros({...filtros, franquia_id: e.target.value})} className="px-3 py-2 text-sm min-w-[150px]">
          <option value="">Todas Franquias</option>
          {franquias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a3a]">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Tipo</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Descrição</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Valor</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Vencimento</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-6 shimmer rounded" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-500">Nenhuma transação encontrada</td></tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-b border-[#1c1c28] table-row-hover">
                    <td className="px-5 py-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.tipo === 'receita' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                        {t.tipo === 'receita' ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-gray-200">{t.descricao}</p>
                      {t.parcela_atual && t.parcela_total && <p className="text-[10px] text-gray-500">{t.parcela_atual}/{t.parcela_total} parcelas</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-sm font-semibold ${t.tipo === 'receita' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.tipo === 'receita' ? '+' : '-'}{formatCurrency(Number(t.valor))}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400">{formatDate(t.data_vencimento)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${getStatusColor(t.status)}`}>
                        {getStatusLabel(t.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="relative">
                        <button onClick={() => setActionMenu(actionMenu === t.id ? null : t.id)} className="p-1.5 rounded-lg hover:bg-[#2a2a3a] transition-colors">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                        {actionMenu === t.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-[#1c1c28] border border-[#2a2a3a] rounded-xl shadow-xl z-20 py-1 animate-in fade-in slide-in-from-top-1">
                            <button onClick={() => handleEdit(t)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a3a] hover:text-white transition-colors">
                              <Pencil className="w-3.5 h-3.5" /> Editar
                            </button>
                            {(t.status === 'pendente' || t.status === 'atrasado') && (
                              <button onClick={() => handleStatusChange(t.id, 'pago')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-400 hover:bg-[#2a2a3a] hover:text-emerald-300 transition-colors">
                                <ArrowUpRight className="w-3.5 h-3.5" /> Marcar Pago
                              </button>
                            )}
                            {t.status === 'pago' && (
                              <button onClick={() => handleStatusChange(t.id, 'pendente')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-yellow-400 hover:bg-[#2a2a3a] hover:text-yellow-300 transition-colors">
                                <ArrowDownRight className="w-3.5 h-3.5" /> Voltar Pendente
                              </button>
                            )}
                            {t.status !== 'cancelado' && (
                              <button onClick={() => handleStatusChange(t.id, 'cancelado')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-400 hover:bg-[#2a2a3a] hover:text-orange-300 transition-colors">
                                <X className="w-3.5 h-3.5" /> Cancelar
                              </button>
                            )}
                            <div className="border-t border-[#2a2a3a] my-1" />
                            <button onClick={() => { setDeleteConfirm(t.id); setActionMenu(null) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Transação */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editingId ? 'Editar Transação' : 'Nova Transação'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null) }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo selector */}
              <div className="flex gap-2">
                {[{v: 'receita', l: 'Receita', c: 'emerald'}, {v: 'despesa', l: 'Despesa', c: 'red'}, {v: 'transferencia', l: 'Transferência', c: 'blue'}].map(t => (
                  <button key={t.v} type="button" onClick={() => setForm({...form, tipo: t.v})}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${form.tipo === t.v
                      ? t.c === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : t.c === 'red' ? 'bg-red-500/10 text-red-400 border-red-500/30' 
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : 'border-[#2a2a3a] text-gray-400 hover:bg-[#1c1c28]'}`}>
                    {t.l}
                  </button>
                ))}
              </div>

              <div><label className="block text-xs text-gray-400 mb-1">Descrição *</label><input type="text" value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
              
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Valor *</label><input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({...form, valor: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Vencimento *</label><input type="date" value={form.data_vencimento} onChange={(e) => setForm({...form, data_vencimento: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Categoria</label>
                  <select value={form.categoria_id} onChange={(e) => setForm({...form, categoria_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="">Selecione</option>
                    {categorias.filter(c => c.tipo === form.tipo || form.tipo === 'transferencia').map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Conta Bancária</label>
                  <select value={form.conta_bancaria_id} onChange={(e) => setForm({...form, conta_bancaria_id: e.target.value, cartao_credito_id: ''})} className="w-full px-3 py-2 text-sm">
                    <option value="">Selecione</option>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.nome} - {c.banco}</option>)}
                  </select>
                </div>
              </div>

              {form.tipo === 'despesa' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Cartão de Crédito (opcional)</label>
                  <select value={form.cartao_credito_id} onChange={(e) => setForm({...form, cartao_credito_id: e.target.value, conta_bancaria_id: ''})} className="w-full px-3 py-2 text-sm">
                    <option value="">Nenhum (pagamento direto)</option>
                    {cartoes.map(c => <option key={c.id} value={c.id}>💳 {c.nome} ({c.bandeira}) •••• {c.ultimos_digitos || '****'}</option>)}
                  </select>
                  {form.cartao_credito_id && <p className="text-[10px] text-indigo-400 mt-1">Gasto será vinculado à fatura do cartão</p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Franquia</label>
                  <select value={form.franquia_id} onChange={(e) => setForm({...form, franquia_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="">Nenhuma</option>
                    {franquias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="agendado">Agendado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Parcelas</label><input type="number" min="1" max="360" value={form.parcela_total} onChange={(e) => setForm({...form, parcela_total: parseInt(e.target.value)})} className="w-full px-3 py-2 text-sm" /></div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={form.is_pessoal} onChange={(e) => setForm({...form, is_pessoal: e.target.checked})} className="w-4 h-4 rounded" />
                    Pessoal
                  </label>
                </div>
              </div>

              <div><label className="block text-xs text-gray-400 mb-1">Observações</label><textarea value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} className="w-full px-3 py-2 text-sm h-20 resize-none" /></div>

              {editingId && (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs text-gray-400 mb-1">Data Pagamento</label><input type="date" value={form.data_pagamento} onChange={(e) => setForm({...form, data_pagamento: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                  <div><label className="block text-xs text-gray-400 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 text-sm">
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="atrasado">Atrasado</option>
                      <option value="agendado">Agendado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null) }} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm">{editingId ? 'Salvar Alterações' : 'Criar Transação'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative w-full max-w-sm glass-card p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Excluir Transação</h3>
                <p className="text-sm text-gray-400">Tem certeza? Esta ação não pode ser desfeita.</p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 text-sm px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors font-medium">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay para fechar menu de ações */}
      {actionMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
      )}
    </div>
  )
}
