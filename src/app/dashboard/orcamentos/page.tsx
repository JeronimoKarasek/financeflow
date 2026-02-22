'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, Plus, X, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Orcamento {
  id: string
  categoria_id: string
  categoria_nome: string
  categoria_cor?: string
  franquia_id: string | null
  franquia_nome: string | null
  mes: number
  ano: number
  valor_previsto: number
  valor_realizado: number
}

interface Categoria { id: string; nome: string; cor: string }
interface Franquia { id: string; nome: string; ativa: boolean }

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [franquias, setFranquias] = useState<Franquia[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1)
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ categoria_id: '', franquia_id: '', valor_previsto: '' })
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetchCategorias()
    fetchFranquias()
  }, [])

  const fetchCategorias = async () => {
    try {
      const res = await fetch('/api/categorias')
      const data = await res.json()
      setCategorias(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }

  const fetchFranquias = async () => {
    try {
      const res = await fetch('/api/franquias')
      const data = await res.json()
      setFranquias(Array.isArray(data) ? data.filter((f: Franquia) => f.ativa) : [])
    } catch { /* ignore */ }
  }

  const fetchOrcamentos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orcamentos?mes=${mesSelecionado}&ano=${anoSelecionado}`)
      const data = await res.json()
      setOrcamentos(Array.isArray(data) ? data : [])
    } catch {
      setOrcamentos([])
    } finally {
      setLoading(false)
    }
  }, [mesSelecionado, anoSelecionado])

  useEffect(() => { fetchOrcamentos() }, [fetchOrcamentos])

  const openNewModal = () => {
    setEditId(null)
    setForm({ categoria_id: '', franquia_id: '', valor_previsto: '' })
    setErro('')
    setModalOpen(true)
  }

  const openEditModal = (orc: Orcamento) => {
    setEditId(orc.id)
    setForm({
      categoria_id: orc.categoria_id,
      franquia_id: orc.franquia_id || '',
      valor_previsto: String(orc.valor_previsto),
    })
    setErro('')
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return
    try {
      const res = await fetch(`/api/orcamentos?id=${id}`, { method: 'DELETE' })
      if (res.ok) fetchOrcamentos()
      else alert('Erro ao excluir')
    } catch { alert('Erro ao excluir') }
  }

  const handleSave = async () => {
    if (!form.categoria_id || !form.valor_previsto) {
      setErro('Preencha categoria e valor previsto')
      return
    }
    setSaving(true)
    setErro('')
    try {
      const body = {
        categoria_id: form.categoria_id,
        franquia_id: form.franquia_id || null,
        mes: mesSelecionado,
        ano: anoSelecionado,
        valor_previsto: parseFloat(form.valor_previsto),
        ...(editId ? { id: editId } : {}),
      }
      const res = await fetch('/api/orcamentos', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setModalOpen(false)
        fetchOrcamentos()
      } else {
        const err = await res.json()
        setErro(err.error || 'Erro ao salvar')
      }
    } catch { setErro('Erro de conexão') }
    finally { setSaving(false) }
  }

  const totalPrevisto = orcamentos.reduce((a, b) => a + Number(b.valor_previsto), 0)
  const totalRealizado = orcamentos.reduce((a, b) => a + Number(b.valor_realizado), 0)
  const percentualGeral = totalPrevisto > 0 ? (totalRealizado / totalPrevisto) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Orçamentos</h1>
          <p className="text-gray-500 text-sm mt-1">Planejamento e controle orçamentário</p>
        </div>
        <button onClick={openNewModal} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Novo Orçamento
        </button>
      </div>

      <div className="flex gap-3">
        <select value={mesSelecionado} onChange={e => setMesSelecionado(+e.target.value)} className="px-3 py-2 text-sm">
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={anoSelecionado} onChange={e => setAnoSelecionado(+e.target.value)} className="px-3 py-2 text-sm">
          {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Previsto</p>
              <p className="text-lg font-bold text-white">{formatCurrency(totalPrevisto)}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${percentualGeral > 100 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
              {percentualGeral > 100 ? <TrendingUp className="w-5 h-5 text-red-400" /> : <TrendingDown className="w-5 h-5 text-emerald-400" />}
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Realizado</p>
              <p className="text-lg font-bold text-white">{formatCurrency(totalRealizado)}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${percentualGeral > 100 ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
              {percentualGeral > 100 ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <CheckCircle2 className="w-5 h-5 text-blue-400" />}
            </div>
            <div>
              <p className="text-xs text-gray-500">Execução</p>
              <p className={`text-lg font-bold ${percentualGeral > 100 ? 'text-red-400' : 'text-white'}`}>{percentualGeral.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-6 shimmer h-64" />
      ) : (
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Orçamentos de {MESES[mesSelecionado - 1]} {anoSelecionado}</h3>
          {orcamentos.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-500 text-sm">Nenhum orçamento cadastrado para este período.</p>
              <button onClick={openNewModal} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm">Criar primeiro orçamento</button>
            </div>
          ) : (
            <div className="space-y-4">
              {orcamentos.map(orc => {
                const pct = Number(orc.valor_previsto) > 0 ? (Number(orc.valor_realizado) / Number(orc.valor_previsto)) * 100 : 0
                const over = pct > 100
                const diff = Number(orc.valor_previsto) - Number(orc.valor_realizado)
                return (
                  <div key={orc.id} className="p-4 rounded-lg bg-[#1c1c28] border border-[#2a2a3a]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-white font-medium text-sm">{orc.categoria_nome}</span>
                        {orc.franquia_nome && <span className="text-gray-500 text-xs ml-2">• {orc.franquia_nome}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-md ${over ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {over ? `+${formatCurrency(Math.abs(diff))} excedido` : `${formatCurrency(diff)} restante`}
                        </span>
                        <button onClick={() => openEditModal(orc)} className="p-1 text-gray-500 hover:text-indigo-400"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(orc.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                      <span>Previsto: {formatCurrency(Number(orc.valor_previsto))}</span>
                      <span>Realizado: {formatCurrency(Number(orc.valor_realizado))}</span>
                      <span className={over ? 'text-red-400' : ''}>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#0d0d14] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${over ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-indigo-500 to-blue-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">{editId ? 'Editar' : 'Novo'} Orçamento</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {erro && <p className="text-red-400 text-sm mb-4 bg-red-500/10 px-3 py-2 rounded">{erro}</p>}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Categoria *</label>
                <select value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Franquia (opcional)</label>
                <select value={form.franquia_id} onChange={e => setForm({...form, franquia_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                  <option value="">Todas</option>
                  {franquias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Valor Previsto *</label>
                <input type="number" step="0.01" value={form.valor_previsto} onChange={e => setForm({...form, valor_previsto: e.target.value})} placeholder="0.00" className="w-full px-3 py-2 text-sm" />
              </div>
              <button onClick={handleSave} disabled={saving} className="btn-primary w-full text-sm py-2.5">
                {saving ? 'Salvando...' : editId ? 'Atualizar Orçamento' : 'Salvar Orçamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
