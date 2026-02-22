'use client'

import { useState, useEffect } from 'react'
import { Wallet, Plus, X, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Orcamento {
  id: string
  categoria_id: string
  categoria_nome: string
  franquia_id: string | null
  franquia_nome: string | null
  mes: number
  ano: number
  valor_previsto: number
  valor_realizado: number
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1)
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const [form, setForm] = useState({ categoria: '', franquia: '', valor_previsto: '' })

  useEffect(() => {
    fetchOrcamentos()
  }, [mesSelecionado, anoSelecionado])

  const fetchOrcamentos = async () => {
    setLoading(true)
    // Mock data as API may not be ready
    setOrcamentos([
      { id: '1', categoria_id: '1', categoria_nome: 'Salários', franquia_id: null, franquia_nome: null, mes: mesSelecionado, ano: anoSelecionado, valor_previsto: 45000, valor_realizado: 42300 },
      { id: '2', categoria_id: '2', categoria_nome: 'Aluguel', franquia_id: null, franquia_nome: null, mes: mesSelecionado, ano: anoSelecionado, valor_previsto: 18000, valor_realizado: 18000 },
      { id: '3', categoria_id: '3', categoria_nome: 'Marketing', franquia_id: null, franquia_nome: null, mes: mesSelecionado, ano: anoSelecionado, valor_previsto: 15000, valor_realizado: 12800 },
      { id: '4', categoria_id: '4', categoria_nome: 'Fornecedores', franquia_id: null, franquia_nome: null, mes: mesSelecionado, ano: anoSelecionado, valor_previsto: 10000, valor_realizado: 11200 },
      { id: '5', categoria_id: '5', categoria_nome: 'Tecnologia', franquia_id: null, franquia_nome: null, mes: mesSelecionado, ano: anoSelecionado, valor_previsto: 6000, valor_realizado: 5400 },
      { id: '6', categoria_id: '6', categoria_nome: 'Impostos', franquia_id: null, franquia_nome: null, mes: mesSelecionado, ano: anoSelecionado, valor_previsto: 8000, valor_realizado: 7500 },
    ])
    setLoading(false)
  }

  const totalPrevisto = orcamentos.reduce((a, b) => a + b.valor_previsto, 0)
  const totalRealizado = orcamentos.reduce((a, b) => a + b.valor_realizado, 0)
  const percentualGeral = totalPrevisto > 0 ? (totalRealizado / totalPrevisto) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Orçamentos</h1>
          <p className="text-gray-500 text-sm mt-1">Planejamento e controle orçamentário</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Novo Orçamento
        </button>
      </div>

      {/* Period selector */}
      <div className="flex gap-3">
        <select value={mesSelecionado} onChange={e => setMesSelecionado(+e.target.value)} className="px-3 py-2 text-sm">
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={anoSelecionado} onChange={e => setAnoSelecionado(+e.target.value)} className="px-3 py-2 text-sm">
          {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Summary Cards */}
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

      {/* Budget Items */}
      {loading ? (
        <div className="glass-card p-6 shimmer h-64" />
      ) : (
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Orçamentos de {MESES[mesSelecionado - 1]} {anoSelecionado}</h3>
          {orcamentos.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum orçamento cadastrado para este período.</p>
          ) : (
            <div className="space-y-4">
              {orcamentos.map(orc => {
                const pct = orc.valor_previsto > 0 ? (orc.valor_realizado / orc.valor_previsto) * 100 : 0
                const over = pct > 100
                const diff = orc.valor_previsto - orc.valor_realizado
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
                        <button className="p-1 text-gray-500 hover:text-indigo-400"><Pencil className="w-3.5 h-3.5" /></button>
                        <button className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                      <span>Previsto: {formatCurrency(orc.valor_previsto)}</span>
                      <span>Realizado: {formatCurrency(orc.valor_realizado)}</span>
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Novo Orçamento</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                <input value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} placeholder="Ex: Salários" className="w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Franquia (opcional)</label>
                <input value={form.franquia} onChange={e => setForm({...form, franquia: e.target.value})} placeholder="Todas" className="w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Valor Previsto</label>
                <input type="number" value={form.valor_previsto} onChange={e => setForm({...form, valor_previsto: e.target.value})} placeholder="0,00" className="w-full px-3 py-2 text-sm" />
              </div>
              <button className="btn-primary w-full text-sm py-2.5">Salvar Orçamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
