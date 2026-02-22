'use client'

import { useState, useEffect } from 'react'
import { FileBarChart, Download, Calendar, Building2, Filter } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
  AreaChart, Area
} from 'recharts'
import type { Franquia } from '@/types/database'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6']

export default function RelatoriosPage() {
  const [tipoRelatorio, setTipoRelatorio] = useState<'dre' | 'fluxo' | 'categorias' | 'franquias'>('dre')
  const [franquias, setFranquias] = useState<Franquia[]>([])
  const [franquiaId, setFranquiaId] = useState('')
  const [periodo, setPeriodo] = useState({ mes: new Date().getMonth() + 1, ano: new Date().getFullYear() })
  const [dreData, setDreData] = useState<Record<string, number>>({})
  const [fluxoData, setFluxoData] = useState<{ mes: string; receitas: number; despesas: number; resultado: number }[]>([])
  const [catData, setCatData] = useState<{ nome: string; valor: number; cor: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFranquias()
    fetchData()
  }, [tipoRelatorio, periodo, franquiaId])

  const fetchFranquias = async () => {
    const res = await fetch('/api/franquias')
    const data = await res.json()
    setFranquias(Array.isArray(data) ? data.filter((f: Franquia) => f.ativa) : [])
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      // Use dashboard API for now as it has aggregated data
      const res = await fetch(`/api/dashboard?periodo=ano`)
      const data = await res.json()

      // Mock DRE data
      setDreData({
        receita_bruta: data.totalReceitas || 158750,
        deducoes: data.totalReceitas * 0.05 || 7937,
        receita_liquida: data.totalReceitas * 0.95 || 150812,
        custos: data.totalDespesas * 0.4 || 36936,
        lucro_bruto: data.totalReceitas * 0.95 - data.totalDespesas * 0.4 || 113876,
        despesas_operacionais: data.totalDespesas * 0.6 || 55404,
        resultado_operacional: (data.totalReceitas * 0.95 - data.totalDespesas * 0.4) - data.totalDespesas * 0.6 || 58472,
        resultado_liquido: data.saldo || 66410,
      })

      setFluxoData(data.fluxoMensal || [
        { mes: 'Set', receitas: 38000, despesas: 25000, resultado: 13000 },
        { mes: 'Out', receitas: 42000, despesas: 28000, resultado: 14000 },
        { mes: 'Nov', receitas: 39500, despesas: 26500, resultado: 13000 },
        { mes: 'Dez', receitas: 51000, despesas: 31000, resultado: 20000 },
        { mes: 'Jan', receitas: 43200, despesas: 27800, resultado: 15400 },
        { mes: 'Fev', receitas: 45200, despesas: 28600, resultado: 16600 },
      ])

      setCatData(data.categoriasDespesas || [
        { nome: 'Salários', valor: 42000, cor: '#f97316' },
        { nome: 'Aluguel', valor: 18000, cor: '#ef4444' },
        { nome: 'Marketing', valor: 12500, cor: '#ec4899' },
        { nome: 'Fornecedores', valor: 9800, cor: '#f59e0b' },
        { nome: 'Tecnologia', valor: 5400, cor: '#6366f1' },
        { nome: 'Outros', valor: 4640, cor: '#6b7280' },
      ])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Análises financeiras completas</p>
        </div>
        <button className="btn-secondary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" /> Exportar PDF
        </button>
      </div>

      {/* Report Type Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'dre' as const, label: 'DRE' },
          { id: 'fluxo' as const, label: 'Fluxo de Caixa' },
          { id: 'categorias' as const, label: 'Por Categorias' },
          { id: 'franquias' as const, label: 'Por Franquias' },
        ].map(tab => (
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={franquiaId} onChange={(e) => setFranquiaId(e.target.value)} className="px-3 py-2 text-sm">
          <option value="">Todas Franquias</option>
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
          {/* DRE */}
          {tipoRelatorio === 'dre' && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Demonstrativo de Resultado do Exercício</h3>
              <div className="space-y-3">
                {[
                  { label: 'Receita Bruta', value: dreData.receita_bruta, type: 'header' },
                  { label: '(-) Deduções', value: -dreData.deducoes, type: 'sub' },
                  { label: '= Receita Líquida', value: dreData.receita_liquida, type: 'total' },
                  { label: '(-) Custos', value: -dreData.custos, type: 'sub' },
                  { label: '= Lucro Bruto', value: dreData.lucro_bruto, type: 'total' },
                  { label: '(-) Despesas Operacionais', value: -dreData.despesas_operacionais, type: 'sub' },
                  { label: '= Resultado Operacional', value: dreData.resultado_operacional, type: 'total' },
                  { label: '= RESULTADO LÍQUIDO', value: dreData.resultado_liquido, type: 'final' },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center justify-between py-3 px-4 rounded-lg ${
                    item.type === 'final' ? 'bg-indigo-500/10 border border-indigo-500/20' :
                    item.type === 'total' ? 'bg-[#1c1c28]' : ''
                  } ${item.type === 'header' ? 'border-b border-[#2a2a3a]' : ''}`}>
                    <span className={`text-sm ${item.type === 'final' ? 'font-bold text-white' : item.type === 'total' ? 'font-semibold text-gray-200' : 'text-gray-400'}`}>
                      {item.label}
                    </span>
                    <span className={`text-sm font-semibold ${
                      item.type === 'final' ? (item.value >= 0 ? 'text-emerald-400' : 'text-red-400') :
                      item.value >= 0 ? 'text-gray-200' : 'text-red-400'
                    }`}>
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fluxo de Caixa */}
          {tipoRelatorio === 'fluxo' && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Fluxo de Caixa</h3>
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
            </div>
          )}

          {/* Categorias */}
          {tipoRelatorio === 'categorias' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Despesas por Categoria</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={catData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="valor">
                      {catData.map((entry, i) => <Cell key={i} fill={entry.cor || COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f0f0f5' }} formatter={(v: number) => [formatCurrency(v)]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Detalhamento</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={catData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis type="number" stroke="#6b7280" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" stroke="#6b7280" fontSize={12} width={100} />
                    <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#f0f0f5' }} formatter={(v: number) => [formatCurrency(v)]} />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                      {catData.map((entry, i) => <Cell key={i} fill={entry.cor || COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Franquias */}
          {tipoRelatorio === 'franquias' && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Comparativo entre Franquias</h3>
              <div className="text-center text-gray-500 py-12">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p>Cadastre suas franquias e transações para visualizar o comparativo</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
