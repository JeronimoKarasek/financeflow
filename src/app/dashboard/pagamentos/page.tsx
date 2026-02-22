'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, Clock, XCircle, DollarSign, CreditCard, Search } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Payment {
  id: string
  valor: number
  status: string
  descricao: string
  cliente: string
  data_criacao: string | null
  data_vencimento: string | null
  data_pagamento: string | null
  tipo_cobranca: string
  link: string | null
  gateway: string
  moeda?: string
}

interface GatewayResult {
  data: Payment[]
  total?: number
  error?: string
}

const GATEWAYS = [
  { id: 'all', label: 'Todos', cor: 'text-white' },
  { id: 'asaas', label: 'Asaas', cor: 'text-blue-400' },
  { id: 'stripe', label: 'Stripe', cor: 'text-purple-400' },
  { id: 'mercadopago', label: 'Mercado Pago', cor: 'text-cyan-400' },
  { id: 'hotmart', label: 'Hotmart', cor: 'text-orange-400' },
]

const STATUS_MAP: Record<string, { label: string; cor: string; icon: typeof CheckCircle2 }> = {
  // Asaas
  CONFIRMED: { label: 'Confirmado', cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  RECEIVED: { label: 'Recebido', cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  RECEIVED_IN_CASH: { label: 'Recebido', cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  PENDING: { label: 'Pendente', cor: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  OVERDUE: { label: 'Atrasado', cor: 'text-red-400 bg-red-500/10 border-red-500/20', icon: AlertTriangle },
  REFUNDED: { label: 'Devolvido', cor: 'text-gray-400 bg-gray-500/10 border-gray-500/20', icon: XCircle },
  // Stripe
  succeeded: { label: 'Sucesso', cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  requires_payment_method: { label: 'Pendente', cor: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  requires_confirmation: { label: 'Aguardando', cor: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  canceled: { label: 'Cancelado', cor: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
  // Mercado Pago
  approved: { label: 'Aprovado', cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  pending: { label: 'Pendente', cor: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  rejected: { label: 'Rejeitado', cor: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
  in_process: { label: 'Em processo', cor: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  // Hotmart
  COMPLETE: { label: 'Completo', cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  APPROVED: { label: 'Aprovado', cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelado', cor: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
  REFUND: { label: 'Reembolso', cor: 'text-gray-400 bg-gray-500/10 border-gray-500/20', icon: XCircle },
}

function getStatusInfo(status: string) {
  return STATUS_MAP[status] || { label: status, cor: 'text-gray-400 bg-gray-500/10 border-gray-500/20', icon: Clock }
}

function getGatewayColor(gw: string) {
  const g = GATEWAYS.find(g => g.id === gw)
  return g?.cor || 'text-gray-400'
}

export default function PagamentosPage() {
  const [results, setResults] = useState<Record<string, GatewayResult>>({})
  const [loading, setLoading] = useState(true)
  const [activeGateway, setActiveGateway] = useState('all')
  const [search, setSearch] = useState('')

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pagamentos-gateway?gateway=all')
      if (res.ok) {
        const data = await res.json()
        setResults(data)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  // Consolidar todos os pagamentos
  const allPayments: Payment[] = []
  const errors: { gateway: string; error: string }[] = []

  for (const [gw, result] of Object.entries(results)) {
    if (result.error) errors.push({ gateway: gw, error: result.error })
    if (result.data) allPayments.push(...result.data)
  }

  // Filtrar por gateway e busca
  const filtered = allPayments
    .filter(p => activeGateway === 'all' || p.gateway === activeGateway)
    .filter(p => !search || p.descricao.toLowerCase().includes(search.toLowerCase()) || p.cliente?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.data_criacao || '').localeCompare(a.data_criacao || ''))

  // Resumos
  const totalVolume = filtered.reduce((s, p) => {
    const statusInfo = getStatusInfo(p.status)
    if (statusInfo.label === 'Sucesso' || statusInfo.label === 'Aprovado' || statusInfo.label === 'Confirmado' || statusInfo.label === 'Recebido' || statusInfo.label === 'Completo') {
      return s + Number(p.valor)
    }
    return s
  }, 0)
  const totalPendente = filtered.reduce((s, p) => {
    const statusInfo = getStatusInfo(p.status)
    if (statusInfo.label === 'Pendente' || statusInfo.label === 'Aguardando' || statusInfo.label === 'Em processo') {
      return s + Number(p.valor)
    }
    return s
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Pagamentos - Gateways</h1>
          <p className="text-gray-500 text-sm mt-1">Informações de pagamentos do Asaas, Stripe, Mercado Pago e Hotmart</p>
        </div>
        <button onClick={fetchPayments} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 border border-emerald-500/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Recebido</p>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalVolume)}</p>
        </div>
        <div className="glass-card p-4 border border-amber-500/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Pendente</p>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-amber-400">{formatCurrency(totalPendente)}</p>
        </div>
        <div className="glass-card p-4 border border-indigo-500/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Total Transações</p>
            <CreditCard className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-xl font-bold text-white">{filtered.length}</p>
        </div>
        <div className="glass-card p-4 border border-purple-500/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Gateways Ativos</p>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-xl font-bold text-white">{Object.entries(results).filter(([, r]) => !r.error && r.data?.length > 0).length}</p>
        </div>
      </div>

      {/* Erros dos gateways */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map(({ gateway, error }) => (
            <div key={gateway} className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 text-amber-400 text-xs px-4 py-2.5 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-semibold capitalize">{gateway}:</span> {error}
            </div>
          ))}
        </div>
      )}

      {/* Filtros: Gateway tabs + busca */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-[#12121a] rounded-lg p-1">
          {GATEWAYS.map(gw => (
            <button key={gw.id} onClick={() => setActiveGateway(gw.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeGateway === gw.id ? 'bg-[#1c1c28] text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {gw.label}
              {gw.id !== 'all' && results[gw.id]?.data?.length !== undefined && (
                <span className="ml-1.5 text-[10px] opacity-60">({results[gw.id]?.data?.length || 0})</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por descrição ou cliente..." className="w-full pl-10 pr-4 py-2 text-sm" />
        </div>
      </div>

      {/* Tabela de pagamentos */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a3a]">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Gateway</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Descrição</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Cliente</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Valor</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Data</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-6 shimmer rounded" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    {allPayments.length === 0
                      ? 'Nenhum gateway configurado ou sem pagamentos. Configure suas credenciais em Configurações → APIs.'
                      : 'Nenhum pagamento encontrado com os filtros atuais.'
                    }
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => {
                  const statusInfo = getStatusInfo(p.status)
                  const StatusIcon = statusInfo.icon
                  return (
                    <tr key={`${p.gateway}-${p.id}-${idx}`} className="border-b border-[#1c1c28] table-row-hover">
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold capitalize ${getGatewayColor(p.gateway)}`}>
                          {p.gateway}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-gray-200 truncate max-w-[200px]">{p.descricao}</p>
                        {p.tipo_cobranca && <p className="text-[10px] text-gray-600">{String(p.tipo_cobranca)}</p>}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400 truncate max-w-[150px]">{p.cliente || '-'}</td>
                      <td className="px-5 py-3">
                        <span className="text-sm font-semibold text-emerald-400">
                          {p.moeda && p.moeda !== 'BRL' ? `${p.moeda} ` : ''}{formatCurrency(Number(p.valor))}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 w-fit ${statusInfo.cor}`}>
                          <StatusIcon className="w-3 h-3" /> {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400">
                        {p.data_pagamento ? formatDate(p.data_pagamento) : p.data_criacao ? formatDate(p.data_criacao) : '-'}
                      </td>
                      <td className="px-5 py-3">
                        {p.link && (
                          <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
