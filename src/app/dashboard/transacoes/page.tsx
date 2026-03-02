'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, ArrowUpRight, ArrowDownRight, X, Calendar, Tag, Building2, Pencil, Trash2, MoreVertical, Sparkles, AlertTriangle as AlertTriangleIcon, CheckCircle, RefreshCw, Check, ChevronsUpDown } from 'lucide-react'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils'
import type { Transacao, Categoria, Franquia, ContaBancaria } from '@/types/database'

interface CartaoCredito {
  id: string
  nome: string
  bandeira: string
  banco: string | null
  ultimos_digitos: string | null
}

interface TransacaoPendencia {
  id: string
  descricao: string
  valor: number
  tipo: string
  data_vencimento: string
  status: string
  categoria_id: string | null
  categoria_nome: string | null
  franquia_id: string | null
  franquia_nome: string | null
}

interface IADetalhe {
  id: string
  descricao: string
  categoria?: string
  franquia?: string
  metodo: string
}

// Helper: primeiro/último dia do mês atual
const primeiroDiaMes = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}
const ultimoDiaMes = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
}

interface Pendencias {
  sem_categoria: TransacaoPendencia[]
  sem_franquia: TransacaoPendencia[]
  sem_ambos: TransacaoPendencia[]
  total: number
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
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [menuTransaction, setMenuTransaction] = useState<Transacao | null>(null)
  const [filtros, setFiltros] = useState({
    tipo: '', status: '', franquia_id: '', search: '',
    data_inicio: primeiroDiaMes(),
    data_fim: ultimoDiaMes(),
  })
  const [duplicatas, setDuplicatas] = useState<{ descricao: string; ids: string[]; valor: number; datas: string[] }[]>([])
  const [duplicatasLoading, setDuplicatasLoading] = useState(false)
  const [pendencias, setPendencias] = useState<Pendencias | null>(null)
  const [showConfirmPessoal, setShowConfirmPessoal] = useState(false)
  const [regularizando, setRegularizando] = useState(false)
  const [classificandoIA, setClassificandoIA] = useState(false)
  const [resultadoRegularizacao, setResultadoRegularizacao] = useState<string | null>(null)
  const [iaDetalhes, setIaDetalhes] = useState<IADetalhe[]>([])

  // Batch edit state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchEdit, setShowBatchEdit] = useState(false)
  const [batchForm, setBatchForm] = useState({ categoria_id: '', franquia_id: '' })
  const [batchSaving, setBatchSaving] = useState(false)

  // Inline edit state (painel de pendências)
  const [inlineEditing, setInlineEditing] = useState<string | null>(null)
  const [inlineForm, setInlineForm] = useState({ categoria_id: '', franquia_id: '' })
  const [inlineSaving, setInlineSaving] = useState(false)
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
      if (filtros.data_inicio) params.set('data_inicio', filtros.data_inicio)
      if (filtros.data_fim) params.set('data_fim', filtros.data_fim)
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

  useEffect(() => { fetchTransacoes() }, [filtros.tipo, filtros.status, filtros.franquia_id, filtros.data_inicio, filtros.data_fim])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Limpar campos vazios para null (evitar erro de FK constraint)
    const payload: Record<string, unknown> = {
      tipo: form.tipo,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      data_vencimento: form.data_vencimento || null,
      data_pagamento: form.data_pagamento || null,
      status: form.status,
      categoria_id: form.categoria_id || null,
      conta_bancaria_id: form.conta_bancaria_id || null,
      franquia_id: form.franquia_id || null,
      cartao_credito_id: form.cartao_credito_id || null,
      is_pessoal: form.is_pessoal,
      recorrente: form.recorrente,
      recorrencia_tipo: form.recorrencia_tipo || null,
      observacoes: form.observacoes || null,
      parcela_total: form.parcela_total || 1,
    }
    try {
      let res: Response
      if (editingId) {
        res = await fetch(`/api/transacoes/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/transacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Erro ao salvar transação')
        return
      }
      setShowModal(false)
      setEditingId(null)
      resetForm()
      fetchTransacoes()
    } catch {
      alert('Erro de conexão ao salvar transação')
    }
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
    closeMenu()
  }

  const closeMenu = () => {
    setActionMenu(null)
    setMenuPos(null)
    setMenuTransaction(null)
  }

  const openMenu = (t: Transacao, e: React.MouseEvent) => {
    e.stopPropagation()
    if (actionMenu === t.id) {
      closeMenu()
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setMenuTransaction(t)
    setActionMenu(t.id)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/transacoes/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Erro ao excluir transação')
        return
      }
    } catch {
      alert('Erro de conexão ao excluir')
    }
    setDeleteConfirm(null)
    closeMenu()
    fetchTransacoes()
  }

  const handleStatusChange = async (id: string, novoStatus: string) => {
    try {
      const res = await fetch(`/api/transacoes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: novoStatus,
          data_pagamento: novoStatus === 'pago' ? new Date().toISOString().split('T')[0] : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Erro ao alterar status')
      }
    } catch {
      alert('Erro de conexão')
    }
    closeMenu()
    fetchTransacoes()
  }

  // ========== INLINE EDIT (painel de pendências) ==========
  const startInlineEdit = (t: TransacaoPendencia) => {
    setInlineEditing(t.id)
    setInlineForm({ categoria_id: t.categoria_id || '', franquia_id: t.franquia_id || '' })
  }

  const saveInlineEdit = async (id: string) => {
    setInlineSaving(true)
    try {
      const updates: Record<string, unknown> = {}
      if (inlineForm.categoria_id) updates.categoria_id = inlineForm.categoria_id
      if (inlineForm.franquia_id) updates.franquia_id = inlineForm.franquia_id
      if (Object.keys(updates).length === 0) { setInlineEditing(null); setInlineSaving(false); return }

      const res = await fetch(`/api/transacoes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        if (pendencias) {
          const removeIfComplete = (list: TransacaoPendencia[]) =>
            list.filter(t => {
              if (t.id !== id) return true
              const newCatId = inlineForm.categoria_id || t.categoria_id
              const newFranqId = inlineForm.franquia_id || t.franquia_id
              return !newCatId || !newFranqId
            })
          const newSemAmbos = removeIfComplete(pendencias.sem_ambos)
          const newSemCategoria = removeIfComplete(pendencias.sem_categoria)
          const newSemFranquia = removeIfComplete(pendencias.sem_franquia)
          setPendencias({
            sem_ambos: newSemAmbos, sem_categoria: newSemCategoria, sem_franquia: newSemFranquia,
            total: newSemAmbos.length + newSemCategoria.length + newSemFranquia.length,
          })
        }
        fetchTransacoes()
      }
    } catch { /* ignore */ }
    finally { setInlineSaving(false); setInlineEditing(null) }
  }

  // ========== BATCH EDIT ==========
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (!pendencias) return
    const allIds = [...pendencias.sem_ambos, ...pendencias.sem_categoria, ...pendencias.sem_franquia].map(t => t.id)
    if (selectedIds.size === allIds.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(allIds))
  }

  const handleBatchSave = async () => {
    if (selectedIds.size === 0) return
    setBatchSaving(true)
    try {
      const updates: Record<string, unknown> = {}
      if (batchForm.categoria_id) updates.categoria_id = batchForm.categoria_id
      if (batchForm.franquia_id) updates.franquia_id = batchForm.franquia_id
      if (Object.keys(updates).length === 0) { setBatchSaving(false); return }

      let successCount = 0
      const ids = Array.from(selectedIds)
      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10)
        const results = await Promise.all(
          batch.map(id =>
            fetch(`/api/transacoes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }).then(r => r.ok)
          )
        )
        successCount += results.filter(Boolean).length
      }
      setResultadoRegularizacao(`✅ ${successCount} de ${ids.length} transações atualizadas em lote`)
      setShowBatchEdit(false)
      setSelectedIds(new Set())
      setBatchForm({ categoria_id: '', franquia_id: '' })
      const dupRes = await fetch('/api/ia/duplicatas')
      const dupData = await dupRes.json()
      setPendencias(dupData.pendencias || null)
      fetchTransacoes()
    } catch { setResultadoRegularizacao('Erro ao salvar em lote') }
    finally { setBatchSaving(false) }
  }

  // ========== VERIFICAR PENDÊNCIAS ==========
  const verificarPendencias = async () => {
    setDuplicatasLoading(true)
    setResultadoRegularizacao(null)
    setIaDetalhes([])
    setSelectedIds(new Set())
    try {
      const res = await fetch('/api/ia/duplicatas')
      const data = await res.json()
      setDuplicatas(data.duplicatas || [])
      setPendencias(data.pendencias || null)
    } catch { /* ignore */ }
    finally { setDuplicatasLoading(false) }
  }

  // ========== AUTO-CLASSIFICAR IA ==========
  const autoClassificar = async () => {
    setClassificandoIA(true)
    setResultadoRegularizacao(null)
    setIaDetalhes([])
    try {
      const res = await fetch('/api/ia/regularizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'auto_classificar' }),
      })
      const data = await res.json()
      if (data.sucesso) {
        setResultadoRegularizacao(`✨ IA classificou ${data.atualizadas} de ${data.total_analisadas} transações`)
        setIaDetalhes(data.detalhes || [])
        const dupRes = await fetch('/api/ia/duplicatas')
        const dupData = await dupRes.json()
        setPendencias(dupData.pendencias || null)
        fetchTransacoes()
      } else {
        setResultadoRegularizacao(`Erro: ${data.error || 'Falha ao classificar'}`)
      }
    } catch { setResultadoRegularizacao('Erro de conexão ao classificar') }
    finally { setClassificandoIA(false) }
  }

  const filtered = transacoes.filter(t =>
    !filtros.search || t.descricao.toLowerCase().includes(filtros.search.toLowerCase())
  )

  const totalReceitas = filtered.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0)
  const totalDespesas = filtered.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0)
  const allPendencias = pendencias ? [...pendencias.sem_ambos, ...pendencias.sem_categoria, ...pendencias.sem_franquia] : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transações</h1>
          <p className="text-gray-500 text-sm mt-1">Receitas, despesas e transferências</p>
        </div>
        <div className="flex gap-2">
          <button onClick={verificarPendencias} disabled={duplicatasLoading}
            className="btn-secondary flex items-center gap-2 text-sm">
            {duplicatasLoading ? <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-400" />}
            Verificar Pendências
          </button>
          <button onClick={() => { resetForm(); setEditingId(null); setShowModal(true) }} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Transação
          </button>
        </div>
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

      {/* Painel de Duplicatas */}
      {duplicatas.length > 0 && (
        <div className="glass-card p-5 border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-red-500/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <AlertTriangleIcon className="w-4 h-4 text-amber-400" />
              {duplicatas.length} Possíveis Duplicatas Detectadas
            </h3>
            <button onClick={() => setDuplicatas([])} className="text-gray-500 hover:text-white text-xs">Fechar</button>
          </div>
          <div className="space-y-2">
            {duplicatas.map((g, i) => (
              <div key={i} className="p-3 rounded-lg bg-[#12121a] border border-amber-500/10 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-200">{g.descricao}</p>
                  <p className="text-[10px] text-gray-500">
                    {g.ids.length} transações × {formatCurrency(g.valor)} • Datas: {g.datas.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ')}
                  </p>
                </div>
                <span className="text-xs text-amber-400 font-medium px-2 py-1 bg-amber-500/10 rounded-lg">
                  {g.ids.length}x
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-2">Revise e exclua manualmente as duplicatas se necessário</p>
        </div>
      )}

      {/* Painel de Pendências (sem categoria/franquia) */}
      {pendencias && pendencias.total > 0 && (
        <div className="glass-card p-5 border border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-indigo-500/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              {pendencias.total} Transações Pendentes de Regularização
            </h3>
            <button onClick={() => { setPendencias(null); setIaDetalhes([]) }} className="text-gray-500 hover:text-white text-xs">Fechar</button>
          </div>

          {/* Resultado da última ação */}
          {resultadoRegularizacao && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-300">{resultadoRegularizacao}</p>
            </div>
          )}

          {/* Detalhes da IA (resultado da auto classificação) */}
          {iaDetalhes.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-purple-500/5 border border-purple-500/15">
              <p className="text-xs font-medium text-purple-300 mb-2">Alterações realizadas pela IA:</p>
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {iaDetalhes.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className={`px-1 py-0.5 rounded text-[9px] font-mono ${
                      d.metodo === 'historico' ? 'bg-blue-500/10 text-blue-400' :
                      d.metodo === 'keywords' ? 'bg-amber-500/10 text-amber-400' :
                      d.metodo === 'openai' ? 'bg-purple-500/10 text-purple-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>{d.metodo}</span>
                    <span className="text-gray-400 truncate flex-1">{d.descricao}</span>
                    {d.categoria && <span className="flex items-center gap-0.5 text-amber-300"><Tag className="w-3 h-3" />{d.categoria}</span>}
                    {d.franquia && <span className="flex items-center gap-0.5 text-indigo-300"><Building2 className="w-3 h-3" />{d.franquia}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumo das pendências por tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {pendencias.sem_ambos.length > 0 && (
              <div className="p-3 rounded-lg bg-[#12121a] border border-red-500/10">
                <p className="text-xs text-red-400 font-medium mb-1">Sem Categoria + Franquia</p>
                <p className="text-xl font-bold text-red-300">{pendencias.sem_ambos.length}</p>
              </div>
            )}
            {pendencias.sem_categoria.length > 0 && (
              <div className="p-3 rounded-lg bg-[#12121a] border border-amber-500/10">
                <p className="text-xs text-amber-400 font-medium mb-1">Sem Categoria</p>
                <p className="text-xl font-bold text-amber-300">{pendencias.sem_categoria.length}</p>
              </div>
            )}
            {pendencias.sem_franquia.length > 0 && (
              <div className="p-3 rounded-lg bg-[#12121a] border border-indigo-500/10">
                <p className="text-xs text-indigo-400 font-medium mb-1">Sem Franquia</p>
                <p className="text-xl font-bold text-indigo-300">{pendencias.sem_franquia.length}</p>
              </div>
            )}
          </div>

          {/* Barra de seleção em lote */}
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={allPendencias.length > 0 && selectedIds.size === allPendencias.length} onChange={toggleSelectAll} className="w-3.5 h-3.5 rounded border-[#2a2a3a]" />
              Selecionar todos ({allPendencias.length})
            </label>
            {selectedIds.size > 0 && (
              <button onClick={() => { setBatchForm({ categoria_id: '', franquia_id: '' }); setShowBatchEdit(true) }}
                className="text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Editar {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
              </button>
            )}
          </div>

          {/* Lista das transações pendentes com edição inline */}
          <div className="space-y-1 mb-4 max-h-[350px] overflow-y-auto">
            {allPendencias.slice(0, 50).map((t) => (
              <div key={t.id} className={`rounded-lg bg-[#12121a] border transition-colors ${
                selectedIds.has(t.id) ? 'border-purple-500/30 bg-purple-500/5' : 'border-[#2a2a3a]'
              } ${inlineEditing === t.id ? 'p-3' : 'p-2.5'}`}>
                {inlineEditing === t.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-200 font-medium">{t.descricao}</p>
                      <div className="flex gap-1">
                        <button onClick={() => saveInlineEdit(t.id)} disabled={inlineSaving}
                          className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                          {inlineSaving ? <div className="w-3.5 h-3.5 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setInlineEditing(null)} className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500">{t.tipo === 'receita' ? '↑ Receita' : '↓ Despesa'} • {formatCurrency(Number(t.valor))} • {new Date(t.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Categoria</label>
                        <select value={inlineForm.categoria_id} onChange={(e) => setInlineForm({ ...inlineForm, categoria_id: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs rounded-md bg-[#0a0a12] border border-[#2a2a3a] text-gray-200">
                          <option value="">Selecione</option>
                          {categorias.filter(c => c.tipo === t.tipo || t.tipo === 'transferencia').map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Franquia</label>
                        <select value={inlineForm.franquia_id} onChange={(e) => setInlineForm({ ...inlineForm, franquia_id: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs rounded-md bg-[#0a0a12] border border-[#2a2a3a] text-gray-200">
                          <option value="">Selecione</option>
                          {franquias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} className="w-3.5 h-3.5 rounded border-[#2a2a3a] flex-shrink-0" />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startInlineEdit(t)}>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-gray-200 truncate">{t.descricao}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-500">{t.tipo === 'receita' ? '↑' : '↓'} {formatCurrency(Number(t.valor))} • {new Date(t.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                        {t.categoria_nome && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5"><Tag className="w-2.5 h-2.5" />{t.categoria_nome}</span>
                        )}
                        {t.franquia_nome && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5" />{t.franquia_nome}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-1 flex-shrink-0">
                      {!t.categoria_id && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">s/ categ.</span>}
                      {!t.franquia_id && <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">s/ franq.</span>}
                      <button onClick={() => startInlineEdit(t)} className="p-1 rounded hover:bg-[#2a2a3a] text-gray-500 hover:text-white transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {allPendencias.length > 50 && <p className="text-[10px] text-gray-500 text-center py-1">... e mais {allPendencias.length - 50} transações</p>}
          </div>

          {/* Ações em massa */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[#2a2a3a]">
            <button onClick={autoClassificar} disabled={classificandoIA || regularizando} className="btn-secondary flex items-center gap-2 text-sm">
              {classificandoIA ? <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-400" />}
              Auto-classificar com IA
            </button>
            {(pendencias.sem_franquia.length > 0 || pendencias.sem_ambos.length > 0) && (
              <button onClick={() => setShowConfirmPessoal(true)} disabled={classificandoIA || regularizando}
                className="btn-secondary flex items-center gap-2 text-sm border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10">
                <Building2 className="w-4 h-4" /> Sem franquia → Pessoal ({pendencias.sem_franquia.length + pendencias.sem_ambos.length})
              </button>
            )}
            <button onClick={verificarPendencias} disabled={duplicatasLoading}
              className="btn-secondary flex items-center gap-1.5 text-xs text-gray-400">
              <RefreshCw className={`w-3.5 h-3.5 ${duplicatasLoading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>

          <p className="text-[10px] text-gray-600 mt-3">
            Clique em qualquer transação para editar categoria/franquia. Selecione várias e use &quot;Editar selecionados&quot; para alterar em lote. A IA busca no histórico para inferir categoria e franquia.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={filtros.search} onChange={(e) => setFiltros({...filtros, search: e.target.value})} placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input type="date" value={filtros.data_inicio} onChange={(e) => setFiltros({...filtros, data_inicio: e.target.value})} className="px-2.5 py-2 text-sm min-w-[130px]" />
          <span className="text-gray-500 text-xs">até</span>
          <input type="date" value={filtros.data_fim} onChange={(e) => setFiltros({...filtros, data_fim: e.target.value})} className="px-2.5 py-2 text-sm min-w-[130px]" />
        </div>
        <select value={filtros.tipo} onChange={(e) => setFiltros({...filtros, tipo: e.target.value})} className="px-3 py-2 text-sm min-w-[120px]">
          <option value="">Todos Tipos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
          <option value="transferencia">Transferências</option>
        </select>
        <select value={filtros.status} onChange={(e) => setFiltros({...filtros, status: e.target.value})} className="px-3 py-2 text-sm min-w-[120px]">
          <option value="">Todos Status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="atrasado">Atrasado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select value={filtros.franquia_id} onChange={(e) => setFiltros({...filtros, franquia_id: e.target.value})} className="px-3 py-2 text-sm min-w-[140px]">
          <option value="">Todas Franquias</option>
          <option value="sem_franquia">Sem Franquia</option>
          {franquias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        {(filtros.data_inicio !== primeiroDiaMes() || filtros.data_fim !== ultimoDiaMes() || filtros.tipo || filtros.status || filtros.franquia_id) && (
          <button onClick={() => setFiltros({ tipo: '', status: '', franquia_id: '', search: filtros.search, data_inicio: primeiroDiaMes(), data_fim: ultimoDiaMes() })}
            className="px-2.5 py-2 text-xs text-gray-400 hover:text-white rounded-lg hover:bg-[#2a2a3a] transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Limpar
          </button>
        )}
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
                filtered.map((t) => {
                  const catNome = (t as Record<string, unknown>)._financeiro_categorias as { nome?: string } | null
                  const franqNome = (t as Record<string, unknown>)._financeiro_franquias as { nome?: string } | null
                  return (
                  <tr key={t.id} className="border-b border-[#1c1c28] table-row-hover">
                    <td className="px-5 py-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.tipo === 'receita' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                        {t.tipo === 'receita' ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-gray-200">{t.descricao}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {catNome?.nome && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1c1c28] text-gray-400 flex items-center gap-0.5"><Tag className="w-2.5 h-2.5" />{catNome.nome}</span>
                        )}
                        {franqNome?.nome && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1c1c28] text-gray-400 flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5" />{franqNome.nome}</span>
                        )}
                        {t.parcela_atual && t.parcela_total && t.parcela_total > 1 && (
                          <span className="text-[10px] text-gray-500">{t.parcela_atual}/{t.parcela_total} parcelas</span>
                        )}
                      </div>
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
                      <button onClick={(e) => openMenu(t, e)} className="p-1.5 rounded-lg hover:bg-[#2a2a3a] transition-colors">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Menu de Ações (renderizado fora da tabela com fixed positioning) */}
      {actionMenu && menuPos && menuTransaction && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div className="fixed z-50 w-48 bg-[#1c1c28] border border-[#2a2a3a] rounded-xl shadow-2xl py-1"
            style={{ top: menuPos.top, right: menuPos.right }}>
            <button onClick={() => handleEdit(menuTransaction)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-300 hover:bg-[#2a2a3a] hover:text-white transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            {(menuTransaction.status === 'pendente' || menuTransaction.status === 'atrasado') && (
              <button onClick={() => handleStatusChange(menuTransaction.id, 'pago')} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-emerald-400 hover:bg-[#2a2a3a] hover:text-emerald-300 transition-colors">
                <ArrowUpRight className="w-3.5 h-3.5" /> Marcar Pago
              </button>
            )}
            {menuTransaction.status === 'pago' && (
              <button onClick={() => handleStatusChange(menuTransaction.id, 'pendente')} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-yellow-400 hover:bg-[#2a2a3a] hover:text-yellow-300 transition-colors">
                <ArrowDownRight className="w-3.5 h-3.5" /> Voltar Pendente
              </button>
            )}
            {menuTransaction.status !== 'cancelado' && (
              <button onClick={() => handleStatusChange(menuTransaction.id, 'cancelado')} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-orange-400 hover:bg-[#2a2a3a] hover:text-orange-300 transition-colors">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            )}
            <div className="border-t border-[#2a2a3a] my-1" />
            <button onClick={() => { setDeleteConfirm(menuTransaction.id); closeMenu() }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          </div>
        </>
      )}

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


      {/* Modal Edição em Lote */}
      {showBatchEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBatchEdit(false)} />
          <div className="relative w-full max-w-md glass-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ChevronsUpDown className="w-5 h-5 text-purple-400" />
                Editar {selectedIds.size} Transações
              </h2>
              <button onClick={() => setShowBatchEdit(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Selecione a categoria e/ou franquia para aplicar em todas as {selectedIds.size} transações selecionadas. Campos em branco não serão alterados.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Tag className="w-3 h-3" /> Categoria</label>
                <select value={batchForm.categoria_id} onChange={(e) => setBatchForm({ ...batchForm, categoria_id: e.target.value })} className="w-full px-3 py-2 text-sm">
                  <option value="">— Não alterar —</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Franquia</label>
                <select value={batchForm.franquia_id} onChange={(e) => setBatchForm({ ...batchForm, franquia_id: e.target.value })} className="w-full px-3 py-2 text-sm">
                  <option value="">— Não alterar —</option>
                  {franquias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div className="text-xs text-gray-500 bg-[#12121a] p-3 rounded-lg max-h-[120px] overflow-y-auto space-y-0.5">
                {allPendencias.filter(t => selectedIds.has(t.id)).slice(0, 15).map(t => (
                  <div key={t.id} className="flex justify-between">
                    <span className="truncate mr-2">{t.descricao}</span>
                    <span className="text-gray-500 flex-shrink-0">{formatCurrency(Number(t.valor))}</span>
                  </div>
                ))}
                {selectedIds.size > 15 && <p className="text-gray-600 text-center">... e mais {selectedIds.size - 15}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowBatchEdit(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button onClick={handleBatchSave} disabled={batchSaving || (!batchForm.categoria_id && !batchForm.franquia_id)}
                  className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
                  {batchSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Aplicar em {selectedIds.size}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal Confirmar Franquia Pessoal */}
      {showConfirmPessoal && pendencias && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmPessoal(false)} />
          <div className="relative w-full max-w-md glass-card p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Atribuir Franquia &quot;Pessoal&quot;</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Tem certeza que deseja mover <strong className="text-white">{pendencias.sem_franquia.length + pendencias.sem_ambos.length}</strong> transações sem franquia para a franquia <strong className="text-indigo-400">&quot;Pessoal&quot;</strong>?
                </p>
                <div className="text-xs text-gray-500 bg-[#12121a] p-3 rounded-lg text-left max-h-[150px] overflow-y-auto space-y-1">
                  {[...pendencias.sem_ambos, ...pendencias.sem_franquia].slice(0, 10).map((t, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="truncate mr-2">{t.descricao}</span>
                      <span className="text-gray-400 flex-shrink-0">{formatCurrency(Number(t.valor))}</span>
                    </div>
                  ))}
                  {pendencias.sem_franquia.length + pendencias.sem_ambos.length > 10 && (
                    <p className="text-gray-600 text-center">... e mais {pendencias.sem_franquia.length + pendencias.sem_ambos.length - 10}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowConfirmPessoal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button
                  onClick={async () => {
                    setRegularizando(true)
                    setResultadoRegularizacao(null)
                    try {
                      const ids = [...pendencias.sem_ambos, ...pendencias.sem_franquia].map(t => t.id)
                      const res = await fetch('/api/ia/regularizar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ acao: 'franquia_pessoal', ids }),
                      })
                      const data = await res.json()
                      if (data.sucesso) {
                        setResultadoRegularizacao(`✅ ${data.atualizadas} transações movidas para franquia "Pessoal"`)
                        setShowConfirmPessoal(false)
                        // Recarregar pendências
                        const dupRes = await fetch('/api/ia/duplicatas')
                        const dupData = await dupRes.json()
                        setPendencias(dupData.pendencias || null)
                        fetchTransacoes()
                      } else {
                        setResultadoRegularizacao(`Erro: ${data.error || 'Falha ao regularizar'}`)
                      }
                    } catch {
                      setResultadoRegularizacao('Erro de conexão ao regularizar')
                    }
                    finally { setRegularizando(false) }
                  }}
                  disabled={regularizando}
                  className="flex-1 text-sm px-4 py-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/30 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {regularizando ? <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Confirmar
                </button>
              </div>
            </div>
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
    </div>
  )
}