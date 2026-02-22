'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Building2, Wallet, Calendar,
  BarChart3
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

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6']

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('mes')

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
      // Dados mock para demonstração
      setData({
        totalReceitas: 158750.00,
        totalDespesas: 92340.00,
        saldo: 66410.00,
        pendentes: 12,
        atrasados: 3,
        receitasMes: 45200.00,
        despesasMes: 28600.00,
        franquias: [
          { nome: 'Franquia Centro', saldo: 25400, cor: '#6366f1' },
          { nome: 'Franquia Norte', saldo: 18200, cor: '#10b981' },
          { nome: 'Franquia Sul', saldo: 15800, cor: '#f59e0b' },
          { nome: 'Pessoal', saldo: 7010, cor: '#ec4899' },
        ],
        fluxoMensal: [
          { mes: 'Set', receitas: 38000, despesas: 25000 },
          { mes: 'Out', receitas: 42000, despesas: 28000 },
          { mes: 'Nov', receitas: 39500, despesas: 26500 },
          { mes: 'Dez', receitas: 51000, despesas: 31000 },
          { mes: 'Jan', receitas: 43200, despesas: 27800 },
          { mes: 'Fev', receitas: 45200, despesas: 28600 },
        ],
        categoriasDespesas: [
          { nome: 'Salários', valor: 12400, cor: '#f97316' },
          { nome: 'Aluguel', valor: 6800, cor: '#ef4444' },
          { nome: 'Marketing', valor: 4200, cor: '#ec4899' },
          { nome: 'Fornecedores', valor: 3100, cor: '#f59e0b' },
          { nome: 'Outros', valor: 2100, cor: '#6b7280' },
        ],
        proximasCobrancas: [
          { id: '1', descricao: 'Fatura Fornecedor X', valor: 4500, vencimento: '2026-02-25', status: 'pendente' },
          { id: '2', descricao: 'Aluguel Março', valor: 3400, vencimento: '2026-03-01', status: 'pendente' },
          { id: '3', descricao: 'Cliente Y - Serviço', valor: 8900, vencimento: '2026-02-20', status: 'atrasado' },
        ],
      })
    } finally {
      setLoading(false)
    }
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
          trend="+12.5%"
          trendUp={true}
        />
        <KPICard
          title="Despesas"
          value={formatCurrency(data.totalDespesas)}
          subtitle={`${formatCurrency(data.despesasMes)} este mês`}
          icon={<TrendingDown className="w-5 h-5" />}
          color="red"
          trend="+3.2%"
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
          <h3 className="text-sm font-semibold text-gray-200 mb-6 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-400" />
            Despesas por Categoria
          </h3>
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
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.cor }} />
                  <span className="text-gray-400">{cat.nome}</span>
                </div>
                <span className="text-gray-300 font-medium">{formatCurrency(cat.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Franquias */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            Saldo por Franquia
          </h3>
          <div className="space-y-3">
            {data.franquias.map((f, i) => {
              const maxSaldo = Math.max(...data.franquias.map(fr => Math.abs(fr.saldo)))
              const width = maxSaldo > 0 ? (Math.abs(f.saldo) / maxSaldo) * 100 : 0
              return (
                <div key={i} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{f.nome}</span>
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
