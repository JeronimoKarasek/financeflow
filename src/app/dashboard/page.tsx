'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Building2, Wallet, Calendar,
  BarChart3, X, ChevronRight
} from 'lucide-react'
import { formatCurrency, getStatusColor } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts'

interface DashboardData {
  totalReceitas: number
  totalDespesas: number
  saldo: number
  pendentes: number
  atrasados: number
  receitasMes: number
  despesasMes: number
  franquias: { nome: string; saldo: number; cor: string }[]
  fluxoMensal: { mes: string; receitas: number; despesas: number }[]
  categoriasDespesas: { nome: string; valor: number; cor: string }[]
  proximasCobrancas: { id: string; descricao: string; valor: number; vencimento: string; status: string }[]
}

interface DrillTransacao { id: string; descricao: string; valor: number; tipo: string; status: string; data_vencimento: string; categoria_nome?: string; franquia_nome?: string }
interface DrillState { type: 'categoria' | 'franquia'; nome: string; cor?: string; transacoes: DrillTransacao[] }

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6']

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('mes')
  const [drill, setDrill] = useState<DrillState | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => {
    fetchDashboard()
  }, [periodo])

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`/api/dashboard?periodo=${periodo}`)
      const result = await res.json()
      setData(result)
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
      setData({
        totalReceitas: 0,
        totalDespesas: 0,
        saldo: 0,
        pendentes: 0,
        atrasados: 0,
        receitasMes: 0,
        despesasMes: 0,
        franquias: [],
        fluxoMensal: [],
        categoriasDespesas: [],
        proximasCobrancas: [],
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDrillCategoria = async (catNome: string, catCor?: string) => {
    setDrillLoading(true)
    try {
      const params = new URLSearchParams({ tipo: 'despesa', limit: '500' })
      const res = await fetch(`/api/transacoes?${params}`)
      const result = await res.json()
      const trans = (result.data || []).filter((t: DrillTransacao & { _financeiro_categorias?: { nome: string } }) => {
        const nome = t._financeiro_categorias?.nome || 'Sem categoria'
        return nome === catNome && t.status !== 'cancelado'
      }).map((t: DrillTransacao & { _financeiro_categorias?: { nome: string }; _financeiro_franquias?: { nome: string } }) => ({
        ...t,
        categoria_nome: t._financeiro_categorias?.nome || 'Sem categoria',
        franquia_nome: t._financeiro_franquias?.nome || null,
      }))
      setDrill({ type: 'categoria', nome: catNome, cor: catCor, transacoes: trans })
    } catch { /* ignore */ }
    setDrillLoading(false)
  }

  const handleDrillFranquia = async (franqNome: string, franqCor?: string) => {
    setDrillLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (franqNome === 'Sem Franquia') {
        params.set('franquia_id', 'sem_franquia')
      }
      const res = await fetch(`/api/transacoes?${params}`)
      const result = await res.json()
      const trans = (result.data || []).filter((t: DrillTransacao & { _financeiro_franquias?: { nome: string } }) => {
        const nome = t._financeiro_franquias?.nome || null
        if (franqNome === 'Sem Franquia') return !nome && t.status !== 'cancelado'
        return nome === franqNome && t.status !== 'cancelado'
      }).map((t: DrillTransacao & { _financeiro_categorias?: { nome: string }; _financeiro_franquias?: { nome: string } }) => ({
        ...t,
        categoria_nome: t._financeiro_categorias?.nome || 'Sem categoria',
        franquia_nome: t._financeiro_franquias?.nome || null,
      }))
      setDrill({ type: 'franquia', nome: franqNome, cor: franqCor, transacoes: trans })
    } catch { /* ignore */ }
    setDrillLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-6 h-32 shimmer" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="glass-card p-6 h-80 shimmer" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const saldoPercent = data.totalReceitas > 0 
    ? ((data.totalReceitas - data.totalDespesas) / data.totalReceitas * 100).toFixed(1) 
    : '0'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Visão geral do seu financeiro</p>
        </div>
        <div className="flex items-center gap-2">
          {(['mes', 'trimestre', 'ano'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                periodo === p
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-[#1c1c28] border border-transparent'
              }`}
            >
              {p === 'mes' ? 'Mês' : p === 'trimestre' ? 'Trimestre' : 'Ano'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Receitas"
          value={formatCurrency(data.totalReceitas)}
          subtitle={`${formatCurrency(data.receitasMes)} este mês`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="emerald"
          trend={data.totalReceitas > 0 ? `${saldoPercent}% margem` : 'Sem dados'}
          trendUp={data.totalReceitas > 0}
        />
        <KPICard
          title="Despesas"
          value={formatCurrency(data.totalDespesas)}
          subtitle={`${formatCurrency(data.despesasMes)} este mês`}
          icon={<TrendingDown className="w-5 h-5" />}
          color="red"
          trend={data.totalDespesas > 0 ? formatCurrency(data.despesasMes) : 'Sem dados'}
          trendUp={false}
        />
        <KPICard
          title="Saldo Líquido"
          value={formatCurrency(data.saldo)}
          subtitle={`Margem: ${saldoPercent}%`}
          icon={<DollarSign className="w-5 h-5" />}
          color="indigo"
          trend={`${saldoPercent}%`}
          trendUp={Number(saldoPercent) > 0}
        />
        <KPICard
          title="Pendências"
          value={String(data.pendentes + data.atrasados)}
          subtitle={`${data.atrasados} atrasados`}
          icon={<Clock className="w-5 h-5" />}
          color="amber"
          trend={data.atrasados > 0 ? `${data.atrasados} alertas` : 'OK'}
          trendUp={data.atrasados === 0}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fluxo Mensal Chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Fluxo de Caixa
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.fluxoMensal}>
              <defs>
                <linearGradient id="receitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="despesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="mes" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#16161f',
                  border: '1px solid #2a2a3a',
                  borderRadius: '8px',
                  color: '#f0f0f5',
                }}
                formatter={(value: number) => [formatCurrency(value)]}
              />
              <Area type="monotone" dataKey="receitas" stroke="#10b981" fill="url(#receitas)" strokeWidth={2} name="Receitas" />
              <Area type="monotone" dataKey="despesas" stroke="#ef4444" fill="url(#despesas)" strokeWidth={2} name="Despesas" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Categorias */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-1 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-400" />
            Despesas por Categoria
          </h3>
          <p className="text-[10px] text-gray-600 mb-4">Clique para detalhar</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.categoriasDespesas}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="valor"
                onClick={(_, idx) => {
                  const cat = data.categoriasDespesas[idx]
                  if (cat) handleDrillCategoria(cat.nome, cat.cor)
                }}
                style={{ cursor: 'pointer' }}
              >
                {data.categoriasDespesas.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.cor || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#16161f',
                  border: '1px solid #2a2a3a',
                  borderRadius: '8px',
                  color: '#f0f0f5',
                }}
                formatter={(value: number) => [formatCurrency(value)]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {data.categoriasDespesas.map((cat, i) => (
              <div key={i}
                onClick={() => handleDrillCategoria(cat.nome, cat.cor)}
                className="flex items-center justify-between text-xs cursor-pointer hover:bg-[#1c1c28] rounded-lg px-2 py-1.5 transition-colors group">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.cor }} />
                  <span className="text-gray-400 group-hover:text-white transition-colors">{cat.nome}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-300 font-medium">{formatCurrency(cat.valor)}</span>
                  <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Franquias */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            Saldo por Franquia
          </h3>
          <p className="text-[10px] text-gray-600 mb-3">Clique para detalhar</p>
          <div className="space-y-3">
            {data.franquias.map((f, i) => {
              const maxSaldo = Math.max(...data.franquias.map(fr => Math.abs(fr.saldo)))
              const width = maxSaldo > 0 ? (Math.abs(f.saldo) / maxSaldo) * 100 : 0
              return (
                <div key={i}
                  onClick={() => handleDrillFranquia(f.nome, f.cor)}
                  className="group cursor-pointer hover:bg-[#1c1c28] rounded-lg p-2 -mx-2 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{f.nome}</span>
                      <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <span className={`text-sm font-semibold ${f.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(f.saldo)}
                    </span>
                  </div>
                  <div className="h-2 bg-[#1c1c28] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${width}%`, backgroundColor: f.cor }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Próximas Cobranças */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            Cobranças Próximas
          </h3>
          <div className="space-y-3">
            {data.proximasCobrancas.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-[#12121a] border border-[#2a2a3a] hover:border-indigo-500/20 transition-colors">
                <div className="flex items-center gap-3">
                  {c.status === 'atrasado' ? (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400" />
                  )}
                  <div>
                    <p className="text-sm text-gray-200">{c.descricao}</p>
                    <p className="text-xs text-gray-500">
                      Vencimento: {new Date(c.vencimento).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-200">{formatCurrency(c.valor)}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(c.status)}`}>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Drill-Down */}
      {(drill || drillLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setDrill(null); setDrillLoading(false) }} />
          <div className="relative w-full max-w-4xl glass-card max-h-[85vh] flex flex-col">
            {drillLoading && !drill ? (
              <div className="p-12 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : drill ? (
              <>
                <div className="flex items-center justify-between p-6 border-b border-[#2a2a3a]">
                  <div className="flex items-center gap-3">
                    {drill.cor && <div className="w-4 h-4 rounded-full" style={{ backgroundColor: drill.cor }} />}
                    {drill.type === 'franquia' && !drill.cor && <Building2 className="w-5 h-5 text-indigo-400" />}
                    <div>
                      <h2 className="text-lg font-bold text-white">{drill.nome}</h2>
                      <p className="text-xs text-gray-500">{drill.transacoes.length} transações • {drill.type === 'categoria' ? 'Categoria' : 'Franquia'}</p>
                    </div>
                  </div>
                  <button onClick={() => setDrill(null)} className="p-2 rounded-lg hover:bg-[#2a2a3a] text-gray-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Resumo */}
                <div className="grid grid-cols-3 gap-3 px-6 py-4">
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-[10px] text-gray-500 uppercase">Receitas</p>
                    <p className="text-sm font-bold text-emerald-400">{formatCurrency(drill.transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0))}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                    <p className="text-[10px] text-gray-500 uppercase">Despesas</p>
                    <p className="text-sm font-bold text-red-400">{formatCurrency(drill.transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0))}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                    <p className="text-[10px] text-gray-500 uppercase">Saldo</p>
                    {(() => {
                      const r = drill.transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0)
                      const d = drill.transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0)
                      return <p className={`text-sm font-bold ${r - d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(r - d)}</p>
                    })()}
                  </div>
                </div>
                {/* Lista de Transações */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-gray-600 font-medium sticky top-0 bg-[#16161f]">
                      <span className="col-span-1">Tipo</span>
                      <span className="col-span-4">Descrição</span>
                      <span className="col-span-2 text-right">Valor</span>
                      <span className="col-span-2 text-center">Vencimento</span>
                      <span className="col-span-2 text-center">Status</span>
                      <span className="col-span-1 text-center">{drill.type === 'categoria' ? 'Franq.' : 'Cat.'}</span>
                    </div>
                    {drill.transacoes.map((t, i) => (
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
                        <span className="col-span-1 text-center text-gray-500 text-xs truncate">
                          {drill.type === 'categoria' ? (t.franquia_nome || '-') : (t.categoria_nome || '-')}
                        </span>
                      </div>
                    ))}
                    {drill.transacoes.length === 0 && (
                      <p className="text-center text-gray-500 py-8 text-sm">Nenhuma transação encontrada</p>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function KPICard({ title, value, subtitle, icon, color, trend, trendUp }: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  color: string
  trend: string
  trendUp: boolean
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/5' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', glow: 'shadow-red-500/5' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', glow: 'shadow-indigo-500/5' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', glow: 'shadow-amber-500/5' },
  }
  const c = colorMap[color] || colorMap.indigo

  return (
    <div className={`glass-card p-5 border ${c.border} hover:shadow-lg ${c.glow} transition-all group`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-bold text-white count-up">{value}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500">{subtitle}</span>
        <span className={`text-xs font-medium flex items-center gap-1 ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </span>
      </div>
    </div>
  )
}
