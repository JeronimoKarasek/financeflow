'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Building2, Wallet, Calendar,
  BarChart3, X, ChevronRight, Target, CircleDollarSign, Layers,
  ArrowRightLeft, FileText
} from 'lucide-react'
import { formatCurrency, getStatusColor } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts'

interface TopTransacao {
  id: string; descricao: string; valor: number; data_vencimento: string;
  status: string; categoria: string | null; franquia: string | null
}
interface UltimaTransacao extends TopTransacao { tipo: string }

interface DashboardData {
  totalReceitas: number
  totalDespesas: number
  saldo: number
  pendentes: number
  atrasados: number
  receitasMes: number
  despesasMes: number
  receitasPendentes: number
  despesasPendentes: number
  valorAtrasado: number
  totalReceitasPeriodo: number
  totalDespesasPeriodo: number
  receitasMesAnterior: number
  despesasMesAnterior: number
  franquias: { nome: string; saldo: number; receitas: number; despesas: number; cor: string }[]
  fluxoMensal: { mes: string; receitas: number; despesas: number; saldo: number }[]
  categoriasDespesas: { nome: string; valor: number; cor: string }[]
  categoriasReceitas: { nome: string; valor: number; cor: string }[]
  topReceitas: TopTransacao[]
  topDespesas: TopTransacao[]
  ultimasTransacoes: UltimaTransacao[]
  proximasCobrancas: { id: string; descricao: string; valor: number; vencimento: string; status: string; tipo: string; nome_contato: string }[]
}

interface DrillTransacao { id: string; descricao: string; valor: number; tipo: string; status: string; data_vencimento: string; categoria_nome?: string; franquia_nome?: string }
interface DrillState { type: 'categoria' | 'franquia'; nome: string; cor?: string; transacoes: DrillTransacao[] }

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6']
const RECEITA_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#059669', '#047857', '#065f46', '#14b8a6', '#2dd4bf']

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('mes')
  const [drill, setDrill] = useState<DrillState | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => { fetchDashboard() }, [periodo])

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`/api/dashboard?periodo=${periodo}`)
      const result = await res.json()
      setData(result)
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
      setData({
        totalReceitas: 0, totalDespesas: 0, saldo: 0, pendentes: 0, atrasados: 0,
        receitasMes: 0, despesasMes: 0, receitasPendentes: 0, despesasPendentes: 0,
        valorAtrasado: 0, totalReceitasPeriodo: 0, totalDespesasPeriodo: 0,
        receitasMesAnterior: 0, despesasMesAnterior: 0,
        franquias: [], fluxoMensal: [], categoriasDespesas: [], categoriasReceitas: [],
        topReceitas: [], topDespesas: [], ultimasTransacoes: [], proximasCobrancas: [],
      })
    } finally { setLoading(false) }
  }

  const handleDrillCategoria = async (catNome: string, catCor?: string, tipo: string = 'despesa') => {
    setDrillLoading(true)
    try {
      const params = new URLSearchParams({ tipo, limit: '500' })
      const res = await fetch(`/api/transacoes?${params}`)
      const result = await res.json()
      const trans = (result.data || []).filter((t: DrillTransacao & { _financeiro_categorias?: { nome: string } }) => {
        const nome = t._financeiro_categorias?.nome || 'Sem categoria'
        return nome === catNome && t.status !== 'cancelado'
      }).map((t: DrillTransacao & { _financeiro_categorias?: { nome: string }; _financeiro_franquias?: { nome: string } }) => ({
        ...t, categoria_nome: t._financeiro_categorias?.nome || 'Sem categoria', franquia_nome: t._financeiro_franquias?.nome || null,
      }))
      setDrill({ type: 'categoria', nome: catNome, cor: catCor, transacoes: trans })
    } catch { /* ignore */ }
    setDrillLoading(false)
  }

  const handleDrillFranquia = async (franqNome: string, franqCor?: string) => {
    setDrillLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (franqNome === 'Sem Franquia') params.set('franquia_id', 'sem_franquia')
      const res = await fetch(`/api/transacoes?${params}`)
      const result = await res.json()
      const trans = (result.data || []).filter((t: DrillTransacao & { _financeiro_franquias?: { nome: string } }) => {
        const nome = t._financeiro_franquias?.nome || null
        if (franqNome === 'Sem Franquia') return !nome && t.status !== 'cancelado'
        return nome === franqNome && t.status !== 'cancelado'
      }).map((t: DrillTransacao & { _financeiro_categorias?: { nome: string }; _financeiro_franquias?: { nome: string } }) => ({
        ...t, categoria_nome: t._financeiro_categorias?.nome || 'Sem categoria', franquia_nome: t._financeiro_franquias?.nome || null,
      }))
      setDrill({ type: 'franquia', nome: franqNome, cor: franqCor, transacoes: trans })
    } catch { /* ignore */ }
    setDrillLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="glass-card p-6 h-28 shimmer" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="glass-card p-6 h-80 shimmer" />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const margem = data.totalReceitas > 0 ? ((data.saldo / data.totalReceitas) * 100).toFixed(1) : '0'
  const varReceitas = data.receitasMesAnterior > 0 ? (((data.receitasMes - data.receitasMesAnterior) / data.receitasMesAnterior) * 100).toFixed(1) : '0'
  const varDespesas = data.despesasMesAnterior > 0 ? (((data.despesasMes - data.despesasMesAnterior) / data.despesasMesAnterior) * 100).toFixed(1) : '0'
  const totalPend = data.receitasPendentes + data.despesasPendentes

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Visão geral completa do seu financeiro</p>
        </div>
        <div className="flex items-center gap-2">
          {(['mes', 'trimestre', 'ano'] as const).map((p) => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                periodo === p ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-gray-400 hover:text-white hover:bg-[#1c1c28] border border-transparent'
              }`}>
              {p === 'mes' ? 'Mês' : p === 'trimestre' ? 'Trimestre' : 'Ano'}
            </button>
          ))}
        </div>
      </div>

      {/* ====== KPI Cards — 6 colunas ====== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniKPI title="Receitas" value={formatCurrency(data.totalReceitas)} sub={`Este mês: ${formatCurrency(data.receitasMes)}`}
          color="emerald" icon={<TrendingUp className="w-4 h-4" />} trend={`${Number(varReceitas) >= 0 ? '+' : ''}${varReceitas}%`} trendUp={Number(varReceitas) >= 0} />
        <MiniKPI title="Despesas" value={formatCurrency(data.totalDespesas)} sub={`Este mês: ${formatCurrency(data.despesasMes)}`}
          color="red" icon={<TrendingDown className="w-4 h-4" />} trend={`${Number(varDespesas) >= 0 ? '+' : ''}${varDespesas}%`} trendUp={Number(varDespesas) <= 0} />
        <MiniKPI title="Saldo Líquido" value={formatCurrency(data.saldo)} sub={`Margem: ${margem}%`}
          color="indigo" icon={<DollarSign className="w-4 h-4" />} trend={`${margem}%`} trendUp={Number(margem) > 0} />
        <MiniKPI title="Rec. Pendentes" value={formatCurrency(data.receitasPendentes)} sub="A receber"
          color="cyan" icon={<Target className="w-4 h-4" />} trend={`${data.pendentes} trans.`} trendUp={true} />
        <MiniKPI title="Desp. Pendentes" value={formatCurrency(data.despesasPendentes)} sub="A pagar"
          color="amber" icon={<Clock className="w-4 h-4" />} trend={totalPend > 0 ? `${data.pendentes} pendências` : 'OK'} trendUp={totalPend === 0} />
        <MiniKPI title="Atrasados" value={formatCurrency(data.valorAtrasado)} sub={`${data.atrasados} transações`}
          color="rose" icon={<AlertTriangle className="w-4 h-4" />} trend={data.atrasados > 0 ? `${data.atrasados} alertas` : 'OK'} trendUp={data.atrasados === 0} />
      </div>

      {/* ====== Resumo Rápido — Barras de Progresso ====== */}
      <div className="glass-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-400">Receitas Totais (período)</span>
              <span className="text-emerald-400 font-medium">{formatCurrency(data.totalReceitasPeriodo)}</span>
            </div>
            <div className="h-2.5 bg-[#1c1c28] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, data.totalReceitasPeriodo > 0 ? (data.totalReceitas / data.totalReceitasPeriodo) * 100 : 0)}%` }} />
            </div>
            <p className="text-[10px] text-gray-600 mt-1">Pago: {formatCurrency(data.totalReceitas)} • Pendente: {formatCurrency(data.receitasPendentes)}</p>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-400">Despesas Totais (período)</span>
              <span className="text-red-400 font-medium">{formatCurrency(data.totalDespesasPeriodo)}</span>
            </div>
            <div className="h-2.5 bg-[#1c1c28] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, data.totalDespesasPeriodo > 0 ? (data.totalDespesas / data.totalDespesasPeriodo) * 100 : 0)}%` }} />
            </div>
            <p className="text-[10px] text-gray-600 mt-1">Pago: {formatCurrency(data.totalDespesas)} • Pendente: {formatCurrency(data.despesasPendentes)}</p>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-400">Mês Anterior (Comparativo)</span>
              <span className="text-indigo-400 font-medium">{formatCurrency(data.receitasMesAnterior - data.despesasMesAnterior)}</span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <div className="h-2.5 bg-[#1c1c28] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${data.receitasMesAnterior + data.despesasMesAnterior > 0 ? (data.receitasMesAnterior / (data.receitasMesAnterior + data.despesasMesAnterior)) * 100 : 50}%` }} />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">Receita: {formatCurrency(data.receitasMesAnterior)} • Despesa: {formatCurrency(data.despesasMesAnterior)}</p>
          </div>
        </div>
      </div>

      {/* ====== Charts Row — Fluxo + Gráfico de Barras Franquias ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fluxo de Caixa — 12 meses */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Fluxo de Caixa (12 meses)
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.fluxoMensal}>
              <defs>
                <linearGradient id="grad-receitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-despesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="mes" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f0f0f5' }}
                formatter={(value: number) => [formatCurrency(value)]} />
              <Area type="monotone" dataKey="receitas" stroke="#10b981" fill="url(#grad-receitas)" strokeWidth={2} name="Receitas" />
              <Area type="monotone" dataKey="despesas" stroke="#ef4444" fill="url(#grad-despesas)" strokeWidth={2} name="Despesas" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Franquias Receita vs Despesa — BarChart */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            Franquias — Receita vs Despesa
          </h3>
          <p className="text-[10px] text-gray-600 mb-4">Clique para detalhar</p>
          {data.franquias.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.franquias} layout="vertical" margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis type="number" stroke="#6b7280" fontSize={10} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" stroke="#6b7280" fontSize={10} width={80} />
                <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f0f0f5' }}
                  formatter={(value: number) => [formatCurrency(value)]} />
                <Bar dataKey="receitas" fill="#10b981" name="Receitas" radius={[0, 4, 4, 0]} barSize={10}
                  onClick={(d) => handleDrillFranquia(d.nome, d.cor)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="despesas" fill="#ef4444" name="Despesas" radius={[0, 4, 4, 0]} barSize={10}
                  onClick={(d) => handleDrillFranquia(d.nome, d.cor)} style={{ cursor: 'pointer' }} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-12">Nenhuma franquia cadastrada</p>
          )}
        </div>
      </div>

      {/* ====== Categorias — Receitas + Despesas ====== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Categorias de Receita */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-1 flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4 text-emerald-400" />
            Receitas por Categoria
          </h3>
          <p className="text-[10px] text-gray-600 mb-4">Clique para detalhar</p>
          {data.categoriasReceitas.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.categoriasReceitas} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="valor"
                    onClick={(_, idx) => { const cat = data.categoriasReceitas[idx]; if (cat) handleDrillCategoria(cat.nome, cat.cor, 'receita') }}
                    style={{ cursor: 'pointer' }}>
                    {data.categoriasReceitas.map((entry, index) => (
                      <Cell key={`rcell-${index}`} fill={entry.cor || RECEITA_COLORS[index % RECEITA_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f0f0f5' }}
                    formatter={(value: number) => [formatCurrency(value)]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {data.categoriasReceitas.map((cat, i) => (
                  <div key={i} onClick={() => handleDrillCategoria(cat.nome, cat.cor, 'receita')}
                    className="flex items-center justify-between text-xs cursor-pointer hover:bg-[#1c1c28] rounded-lg px-2 py-1.5 transition-colors group">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.cor || RECEITA_COLORS[i % RECEITA_COLORS.length] }} />
                      <span className="text-gray-400 group-hover:text-white transition-colors">{cat.nome}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-400 font-medium">{formatCurrency(cat.valor)}</span>
                      <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <CircleDollarSign className="w-10 h-10 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Sem receitas categorizadas</p>
            </div>
          )}
        </div>

        {/* Categorias de Despesa */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-1 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-red-400" />
            Despesas por Categoria
          </h3>
          <p className="text-[10px] text-gray-600 mb-4">Clique para detalhar</p>
          {data.categoriasDespesas.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.categoriasDespesas} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="valor"
                    onClick={(_, idx) => { const cat = data.categoriasDespesas[idx]; if (cat) handleDrillCategoria(cat.nome, cat.cor) }}
                    style={{ cursor: 'pointer' }}>
                    {data.categoriasDespesas.map((entry, index) => (
                      <Cell key={`dcell-${index}`} fill={entry.cor || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f0f0f5' }}
                    formatter={(value: number) => [formatCurrency(value)]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {data.categoriasDespesas.map((cat, i) => (
                  <div key={i} onClick={() => handleDrillCategoria(cat.nome, cat.cor)}
                    className="flex items-center justify-between text-xs cursor-pointer hover:bg-[#1c1c28] rounded-lg px-2 py-1.5 transition-colors group">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.cor || COLORS[i % COLORS.length] }} />
                      <span className="text-gray-400 group-hover:text-white transition-colors">{cat.nome}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-red-400 font-medium">{formatCurrency(cat.valor)}</span>
                      <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-red-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <Wallet className="w-10 h-10 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Sem despesas categorizadas</p>
            </div>
          )}
        </div>
      </div>

      {/* ====== Top Transações + Franquias Saldo ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Receitas */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            Top Receitas
          </h3>
          <div className="space-y-2">
            {data.topReceitas.length > 0 ? data.topReceitas.map((t, i) => (
              <div key={t.id || i} className="flex items-center justify-between p-2.5 rounded-lg bg-[#12121a] border border-[#2a2a3a] hover:border-emerald-500/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-emerald-400/60 text-xs font-bold min-w-[18px]">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200 truncate">{t.descricao}</p>
                    <p className="text-[10px] text-gray-600">{t.categoria || 'Sem cat.'} {t.franquia ? `• ${t.franquia}` : ''}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-400 ml-2 whitespace-nowrap">{formatCurrency(t.valor)}</span>
              </div>
            )) : <p className="text-gray-500 text-sm text-center py-6">Sem dados</p>}
          </div>
        </div>

        {/* Top Despesas */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4 text-red-400" />
            Top Despesas
          </h3>
          <div className="space-y-2">
            {data.topDespesas.length > 0 ? data.topDespesas.map((t, i) => (
              <div key={t.id || i} className="flex items-center justify-between p-2.5 rounded-lg bg-[#12121a] border border-[#2a2a3a] hover:border-red-500/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-red-400/60 text-xs font-bold min-w-[18px]">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200 truncate">{t.descricao}</p>
                    <p className="text-[10px] text-gray-600">{t.categoria || 'Sem cat.'} {t.franquia ? `• ${t.franquia}` : ''}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-red-400 ml-2 whitespace-nowrap">{formatCurrency(t.valor)}</span>
              </div>
            )) : <p className="text-gray-500 text-sm text-center py-6">Sem dados</p>}
          </div>
        </div>

        {/* Saldo por Franquia */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-1 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Saldo por Franquia
          </h3>
          <p className="text-[10px] text-gray-600 mb-3">Clique para detalhar</p>
          <div className="space-y-3">
            {data.franquias.map((f, i) => {
              const maxSaldo = Math.max(...data.franquias.map(fr => Math.abs(fr.saldo)), 1)
              const width = (Math.abs(f.saldo) / maxSaldo) * 100
              return (
                <div key={i} onClick={() => handleDrillFranquia(f.nome, f.cor)}
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
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${width}%`, backgroundColor: f.cor }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ====== Últimas Transações + Cobranças ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimas Transações */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
            Últimas Transações
          </h3>
          <div className="space-y-1.5">
            {data.ultimasTransacoes.length > 0 ? data.ultimasTransacoes.map((t, i) => (
              <div key={t.id || i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#1c1c28] transition-colors border border-transparent hover:border-[#2a2a3a]">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.tipo === 'receita' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200 truncate">{t.descricao}</p>
                    <p className="text-[10px] text-gray-600">
                      {t.data_vencimento ? new Date(t.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                      {t.categoria ? ` • ${t.categoria}` : ''} {t.franquia ? `• ${t.franquia}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className={`text-sm font-medium whitespace-nowrap ${t.tipo === 'receita' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t.tipo === 'receita' ? '+' : '-'}{formatCurrency(t.valor)}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                    t.status === 'pago' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                    t.status === 'pendente' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                    t.status === 'atrasado' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                    'text-gray-400 border-gray-500/30 bg-gray-500/10'
                  }`}>{t.status}</span>
                </div>
              </div>
            )) : <p className="text-gray-500 text-sm text-center py-6">Sem transações recentes</p>}
          </div>
        </div>

        {/* Cobranças Próximas */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            Cobranças Próximas
          </h3>
          <div className="space-y-2">
            {data.proximasCobrancas.length > 0 ? data.proximasCobrancas.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-[#12121a] border border-[#2a2a3a] hover:border-indigo-500/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {c.status === 'atrasado' ? (
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-200 truncate">{c.descricao}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${c.tipo === 'receber' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {c.tipo === 'receber' ? 'Receber' : 'Pagar'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-600">
                      {c.nome_contato ? `${c.nome_contato} • ` : ''}Vence: {new Date(c.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="text-right ml-2">
                  <p className="text-sm font-semibold text-gray-200">{formatCurrency(c.valor)}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(c.status)}`}>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </span>
                </div>
              </div>
            )) : (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Nenhuma cobrança pendente</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====== Modal Drill-Down ====== */}
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

/* ====== Mini KPI Card ====== */
function MiniKPI({ title, value, sub, color, icon, trend, trendUp }: {
  title: string; value: string; sub: string; color: string; icon: React.ReactNode; trend: string; trendUp: boolean
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  }
  const c = colorMap[color] || colorMap.indigo

  return (
    <div className={`glass-card p-4 border ${c.border} hover:shadow-lg transition-all`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{title}</span>
        <div className={`p-1.5 rounded-lg ${c.bg}`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <p className="text-lg font-bold text-white leading-tight">{value}</p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-gray-600">{sub}</span>
        <span className={`text-[10px] font-medium flex items-center gap-0.5 ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {trendUp ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
          {trend}
        </span>
      </div>
    </div>
  )
}
