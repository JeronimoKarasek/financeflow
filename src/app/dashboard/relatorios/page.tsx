'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, ChevronRight, ArrowLeft, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Line, Legend,
  AreaChart, Area
} from 'recharts'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6']

interface FranquiaOption { id: string; nome: string; ativa: boolean }
interface DreItem { label: string; valor: number; tipo: string }
interface FluxoItem { mes: string; receitas: number; despesas: number; resultado: number }
interface CatItem { nome: string; valor: number; cor: string }
interface FranquiaData { nome: string; receitas: number; despesas: number; saldo: number }
interface Transacao { id?: string; descricao?: string; tipo: string; status: string; valor: number; data_vencimento?: string; categoria_nome?: string; franquia_nome?: string; _financeiro_categorias?: { nome: string; cor?: string; icone?: string }; _financeiro_franquias?: { nome: string } }

interface DrillLevel {
  type: 'categoria' | 'franquia'
  nome: string
  cor?: string
  transacoes: Transacao[]
}

export default function RelatoriosPage() {
  const [tipoRelatorio, setTipoRelatorio] = useState<'dre' | 'fluxo' | 'categorias' | 'franquias'>('dre')
  const [franquias, setFranquias] = useState<FranquiaOption[]>([])
  const [franquiaId, setFranquiaId] = useState('')
  const [periodo, setPeriodo] = useState({ mes: new Date().getMonth() + 1, ano: new Date().getFullYear() })
  const [dreData, setDreData] = useState<DreItem[]>([])
  const [fluxoData, setFluxoData] = useState<FluxoItem[]>([])
  const [catData, setCatData] = useState<CatItem[]>([])
  const [franquiasData, setFranquiasData] = useState<FranquiaData[]>([])
  const [loading, setLoading] = useState(true)
  const [allTransacoes, setAllTransacoes] = useState<Transacao[]>([])
  const [drillDown, setDrillDown] = useState<DrillLevel | null>(null)

  useEffect(() => { fetchFranquias() }, [])

  const fetchFranquias = async () => {
    try {
      const res = await fetch('/api/franquias')
      const data = await res.json()
      setFranquias(Array.isArray(data) ? data.filter((f: FranquiaOption) => f.ativa) : [])
    } catch { /* ignore */ }
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}-01`
      const endDate = new Date(periodo.ano, periodo.mes, 0).toISOString().split('T')[0]

      const params = new URLSearchParams({ data_inicio: startDate, data_fim: endDate, limit: '10000' })
      if (franquiaId && franquiaId !== 'sem_franquia') params.set('franquia_id', franquiaId)

      const res = await fetch(`/api/transacoes?${params}`)
      const result = await res.json()
      let transacoes: Transacao[] = (result.data || []).map((t: Transacao & { franquia_id?: string | null }) => ({
        ...t,
        categoria_nome: t._financeiro_categorias?.nome || 'Sem categoria',
        franquia_nome: t._financeiro_franquias?.nome || null,
      }))

      // Filtrar transações sem franquia se selecionado
      if (franquiaId === 'sem_franquia') {
        transacoes = transacoes.filter(t => !t.franquia_nome)
      }

      setAllTransacoes(transacoes)
      setDrillDown(null)

      const receitas = transacoes.filter(t => t.tipo === 'receita' && t.status !== 'cancelado')
      const despesas = transacoes.filter(t => t.tipo === 'despesa' && t.status !== 'cancelado')
      const totalReceitas = receitas.reduce((s, t) => s + Number(t.valor), 0)
      const totalDespesas = despesas.reduce((s, t) => s + Number(t.valor), 0)
      const resultadoLiq = totalReceitas - totalDespesas

      setDreData([
        { label: 'Receita Bruta', valor: totalReceitas, tipo: 'header' },
        { label: '(-) Impostos (~3,65%)', valor: -(totalReceitas * 0.0365), tipo: 'sub' },
        { label: '= Receita Líquida', valor: totalReceitas * 0.9635, tipo: 'total' },
        { label: '(-) Custos Diretos', valor: -(totalDespesas * 0.4), tipo: 'sub' },
        { label: '= Lucro Bruto', valor: totalReceitas * 0.9635 - totalDespesas * 0.4, tipo: 'total' },
        { label: '(-) Despesas Operacionais', valor: -(totalDespesas * 0.6), tipo: 'sub' },
        { label: '= Resultado Operacional', valor: totalReceitas * 0.9635 - totalDespesas, tipo: 'total' },
        { label: '= RESULTADO LÍQUIDO', valor: resultadoLiq, tipo: 'final' },
      ])

      // Fluxo mensal real da API dashboard
      try {
        const fluxoRes = await fetch('/api/dashboard?periodo=ano')
        const fluxoResult = await fluxoRes.json()
        setFluxoData((fluxoResult.fluxoMensal || []).map((f: { mes: string; receitas: number; despesas: number }) => ({
          ...f, resultado: f.receitas - f.despesas,
        })))
        setCatData(fluxoResult.categoriasDespesas || [])
      } catch {
        setFluxoData([])
        setCatData([])
      }

      // Categorias do período atual
      const catMap = new Map<string, number>()
      despesas.forEach(t => {
        const cat = t.categoria_nome || 'Sem categoria'
        catMap.set(cat, (catMap.get(cat) || 0) + Number(t.valor))
      })
      if (catMap.size > 0) {
        setCatData(Array.from(catMap.entries())
          .map(([nome, valor], i) => ({ nome, valor, cor: COLORS[i % COLORS.length] }))
          .sort((a, b) => b.valor - a.valor))
      }

      // Franquias comparativo (inclui "Sem Franquia")
      {
        const franqMap = new Map<string, { receitas: number; despesas: number }>()
        franquias.forEach(f => franqMap.set(f.nome, { receitas: 0, despesas: 0 }))
        franqMap.set('Sem Franquia', { receitas: 0, despesas: 0 })
        transacoes.forEach(t => {
          if (t.status === 'cancelado') return
          const key = t.franquia_nome || 'Sem Franquia'
          if (!franqMap.has(key)) franqMap.set(key, { receitas: 0, despesas: 0 })
          const entry = franqMap.get(key)!
          if (t.tipo === 'receita') entry.receitas += Number(t.valor)
          else entry.despesas += Number(t.valor)
        })
        setFranquiasData(Array.from(franqMap.entries()).map(([nome, v]) => ({
          nome, receitas: v.receitas, despesas: v.despesas, saldo: v.receitas - v.despesas,
        })).filter(f => f.receitas > 0 || f.despesas > 0))
      }
    } catch (err) {
      console.error('Erro ao carregar relatório:', err)
    } finally {
      setLoading(false)
    }
  }, [periodo, franquiaId, franquias])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Relatórios</h1>
        <p className="text-gray-500 text-sm mt-1">Análises financeiras baseadas em dados reais</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { id: 'dre' as const, label: 'DRE' },
          { id: 'fluxo' as const, label: 'Fluxo de Caixa' },
          { id: 'categorias' as const, label: 'Por Categorias' },
          { id: 'franquias' as const, label: 'Por Franquias' },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setTipoRelatorio(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              tipoRelatorio === tab.id
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                : 'border-transparent text-gray-400 hover:bg-[#1c1c28] hover:text-white'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select value={franquiaId} onChange={(e) => setFranquiaId(e.target.value)} className="px-3 py-2 text-sm">
          <option value="">Todas Franquias</option>
          <option value="sem_franquia">Sem Franquia</option>
          {franquias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <select value={periodo.mes} onChange={(e) => setPeriodo({...periodo, mes: parseInt(e.target.value)})} className="px-3 py-2 text-sm">
          {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(2000, i).toLocaleDateString('pt-BR', { month: 'long' })}</option>)}
        </select>
        <select value={periodo.ano} onChange={(e) => setPeriodo({...periodo, ano: parseInt(e.target.value)})} className="px-3 py-2 text-sm">
          {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="glass-card h-96 shimmer" />
      ) : (
        <>
          {tipoRelatorio === 'dre' && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Demonstrativo de Resultado do Exercício</h3>
              {dreData.every(d => d.valor === 0) ? (
                <p className="text-gray-500 text-sm text-center py-12">Nenhuma transação encontrada neste período. Cadastre receitas e despesas para gerar o DRE.</p>
              ) : (
                <div className="space-y-3">
                  {dreData.map((item, i) => (
                    <div key={i} className={`flex items-center justify-between py-3 px-4 rounded-lg ${
                      item.tipo === 'final' ? 'bg-indigo-500/10 border border-indigo-500/20' :
                      item.tipo === 'total' ? 'bg-[#1c1c28]' : ''
                    } ${item.tipo === 'header' ? 'border-b border-[#2a2a3a]' : ''}`}>
                      <span className={`text-sm ${item.tipo === 'final' ? 'font-bold text-white' : item.tipo === 'total' ? 'font-semibold text-gray-200' : 'text-gray-400'}`}>
                        {item.label}
                      </span>
                      <span className={`text-sm font-semibold ${
                        item.tipo === 'final' ? (item.valor >= 0 ? 'text-emerald-400' : 'text-red-400') :
                        item.valor >= 0 ? 'text-gray-200' : 'text-red-400'
                      }`}>
                        {formatCurrency(item.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tipoRelatorio === 'fluxo' && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Fluxo de Caixa</h3>
              {fluxoData.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-12">Nenhum dado de fluxo disponível. Cadastre transações para visualizar.</p>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={fluxoData}>
                    <defs>
                      <linearGradient id="rec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="desp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis dataKey="mes" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f0f0f5' }} formatter={(v: number) => [formatCurrency(v)]} />
                    <Legend />
                    <Area type="monotone" dataKey="receitas" stroke="#10b981" fill="url(#rec)" strokeWidth={2} name="Receitas" />
                    <Area type="monotone" dataKey="despesas" stroke="#ef4444" fill="url(#desp)" strokeWidth={2} name="Despesas" />
                    <Line type="monotone" dataKey="resultado" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} name="Resultado" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {tipoRelatorio === 'categorias' && (
            <div className="space-y-4">
              {drillDown?.type === 'categoria' ? (
                <div className="glass-card p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setDrillDown(null)} className="p-1.5 rounded-lg hover:bg-[#2a2a3a] transition-colors text-gray-400 hover:text-white">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: drillDown.cor }} />
                      <h3 className="text-lg font-semibold text-white">{drillDown.nome}</h3>
                    </div>
                    <span className="text-sm text-gray-500">({drillDown.transacoes.length} transações)</span>
                    <span className="ml-auto text-lg font-bold text-red-400">
                      {formatCurrency(drillDown.transacoes.reduce((s, t) => s + Number(t.valor), 0))}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-gray-600 font-medium">
                      <span className="col-span-1">Tipo</span>
                      <span className="col-span-4">Descrição</span>
                      <span className="col-span-2 text-right">Valor</span>
                      <span className="col-span-2 text-center">Vencimento</span>
                      <span className="col-span-2 text-center">Status</span>
                      <span className="col-span-1 text-center">Franquia</span>
                    </div>
                    {drillDown.transacoes.map((t, i) => (
                      <div key={t.id || i} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-[#1c1c28] transition-colors text-sm border border-transparent hover:border-[#2a2a3a]">
                        <span className="col-span-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${t.tipo === 'receita' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        </span>
                        <span className="col-span-4 text-gray-300 truncate">{t.descricao || 'Sem descrição'}</span>
                        <span className={`col-span-2 text-right font-medium ${t.tipo === 'receita' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(Number(t.valor))}
                        </span>
                        <span className="col-span-2 text-center text-gray-500 text-xs">{t.data_vencimento ? new Date(t.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                        <span className="col-span-2 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            t.status === 'pago' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                            t.status === 'pendente' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                            t.status === 'atrasado' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                            'text-gray-400 border-gray-500/30 bg-gray-500/10'
                          }`}>{t.status}</span>
                        </span>
                        <span className="col-span-1 text-center text-gray-500 text-xs truncate">{t.franquia_nome || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Despesas por Categoria</h3>
                  <p className="text-xs text-gray-500 mb-4">Clique em uma categoria para detalhar</p>
                  {catData.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-12">Nenhuma despesa encontrada neste período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={catData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="valor"
                          onClick={(_, idx) => {
                            const cat = catData[idx]
                            if (!cat) return
                            const trans = allTransacoes.filter(t => t.tipo === 'despesa' && t.status !== 'cancelado' && (t.categoria_nome || 'Sem categoria') === cat.nome)
                            setDrillDown({ type: 'categoria', nome: cat.nome, cor: cat.cor, transacoes: trans })
                          }}
                          style={{ cursor: 'pointer' }}>
                          {catData.map((entry, i) => <Cell key={i} fill={entry.cor || COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f0f0f5' }} formatter={(v: number) => [formatCurrency(v)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Detalhamento</h3>
                  <p className="text-xs text-gray-500 mb-4">Clique para ver as transações</p>
                  {catData.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-12">Sem dados</p>
                  ) : (
                    <div className="space-y-2">
                      {catData.map((cat, i) => {
                        const total = catData.reduce((s, c) => s + c.valor, 0)
                        const pct = total > 0 ? ((cat.valor / total) * 100).toFixed(1) : '0'
                        return (
                          <div key={i}
                            onClick={() => {
                              const trans = allTransacoes.filter(t => t.tipo === 'despesa' && t.status !== 'cancelado' && (t.categoria_nome || 'Sem categoria') === cat.nome)
                              setDrillDown({ type: 'categoria', nome: cat.nome, cor: cat.cor || COLORS[i % COLORS.length], transacoes: trans })
                            }}
                            className="flex items-center gap-3 p-3 rounded-lg bg-[#1c1c28] hover:bg-[#22222f] cursor-pointer transition-colors group border border-transparent hover:border-indigo-500/20">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.cor || COLORS[i % COLORS.length] }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{cat.nome}</span>
                                <span className="text-sm font-semibold text-red-400">{formatCurrency(cat.valor)}</span>
                              </div>
                              <div className="mt-1 h-1.5 bg-[#12121a] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.cor || COLORS[i % COLORS.length] }} />
                              </div>
                              <span className="text-[10px] text-gray-600 mt-0.5">{pct}% do total</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          )}

          {tipoRelatorio === 'franquias' && (
            <div className="space-y-4">
              {drillDown?.type === 'franquia' ? (
                <div className="glass-card p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setDrillDown(null)} className="p-1.5 rounded-lg hover:bg-[#2a2a3a] transition-colors text-gray-400 hover:text-white">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <Building2 className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-semibold text-white">{drillDown.nome}</h3>
                    <span className="text-sm text-gray-500">({drillDown.transacoes.length} transações)</span>
                  </div>
                  {/* Resumo da franquia */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                      <p className="text-[10px] text-gray-500 uppercase">Receitas</p>
                      <p className="text-sm font-bold text-emerald-400">{formatCurrency(drillDown.transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0))}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <p className="text-[10px] text-gray-500 uppercase">Despesas</p>
                      <p className="text-sm font-bold text-red-400">{formatCurrency(drillDown.transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0))}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                      <p className="text-[10px] text-gray-500 uppercase">Saldo</p>
                      {(() => {
                        const rec = drillDown.transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0)
                        const desp = drillDown.transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0)
                        const saldo = rec - desp
                        return <p className={`text-sm font-bold ${saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(saldo)}</p>
                      })()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-gray-600 font-medium">
                      <span className="col-span-1">Tipo</span>
                      <span className="col-span-4">Descrição</span>
                      <span className="col-span-2 text-right">Valor</span>
                      <span className="col-span-2 text-center">Vencimento</span>
                      <span className="col-span-2 text-center">Status</span>
                      <span className="col-span-1 text-center">Categoria</span>
                    </div>
                    {drillDown.transacoes.map((t, i) => (
                      <div key={t.id || i} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-[#1c1c28] transition-colors text-sm border border-transparent hover:border-[#2a2a3a]">
                        <span className="col-span-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${t.tipo === 'receita' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        </span>
                        <span className="col-span-4 text-gray-300 truncate">{t.descricao || 'Sem descrição'}</span>
                        <span className={`col-span-2 text-right font-medium ${t.tipo === 'receita' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(Number(t.valor))}
                        </span>
                        <span className="col-span-2 text-center text-gray-500 text-xs">{t.data_vencimento ? new Date(t.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                        <span className="col-span-2 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            t.status === 'pago' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                            t.status === 'pendente' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                            t.status === 'atrasado' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                            'text-gray-400 border-gray-500/30 bg-gray-500/10'
                          }`}>{t.status}</span>
                        </span>
                        <span className="col-span-1 text-center text-gray-500 text-xs truncate">{t.categoria_nome || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Comparativo entre Franquias</h3>
              <p className="text-xs text-gray-500 mb-4">Clique em uma franquia para detalhar</p>
              {franquiasData.length === 0 || franquiasData.every(f => f.receitas === 0 && f.despesas === 0) ? (
                <div className="text-center text-gray-500 py-12">
                  <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <p>Cadastre franquias e transações para visualizar o comparativo</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={franquiasData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                      <XAxis dataKey="nome" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f0f0f5' }} formatter={(v: number) => [formatCurrency(v)]} />
                      <Legend />
                      <Bar dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} name="Receitas"
                        onClick={(data) => {
                          if (!data?.nome) return
                          const trans = allTransacoes.filter(t => t.status !== 'cancelado' && (data.nome === 'Sem Franquia' ? !t.franquia_nome : t.franquia_nome === data.nome))
                          setDrillDown({ type: 'franquia', nome: data.nome, transacoes: trans })
                        }} style={{ cursor: 'pointer' }} />
                      <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Despesas"
                        onClick={(data) => {
                          if (!data?.nome) return
                          const trans = allTransacoes.filter(t => t.status !== 'cancelado' && (data.nome === 'Sem Franquia' ? !t.franquia_nome : t.franquia_nome === data.nome))
                          setDrillDown({ type: 'franquia', nome: data.nome, transacoes: trans })
                        }} style={{ cursor: 'pointer' }} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-6 space-y-2">
                    {franquiasData.map((f, i) => (
                      <div key={i}
                        onClick={() => {
                          const trans = allTransacoes.filter(t => t.status !== 'cancelado' && (f.nome === 'Sem Franquia' ? !t.franquia_nome : t.franquia_nome === f.nome))
                          setDrillDown({ type: 'franquia', nome: f.nome, transacoes: trans })
                        }}
                        className="flex items-center justify-between p-3 rounded-lg bg-[#1c1c28] hover:bg-[#22222f] cursor-pointer transition-colors group border border-transparent hover:border-indigo-500/20">
                        <span className="text-sm text-white group-hover:text-indigo-300 transition-colors">{f.nome}</span>
                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-emerald-400">{formatCurrency(f.receitas)}</span>
                          <span className="text-red-400">{formatCurrency(f.despesas)}</span>
                          <span className={f.saldo >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>{formatCurrency(f.saldo)}</span>
                          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
