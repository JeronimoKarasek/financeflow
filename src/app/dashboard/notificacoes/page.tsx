'use client'

import { useState, useEffect } from 'react'
import { Bell, MessageSquare, CheckCircle2, XCircle, Clock, RefreshCw, Filter, Search } from 'lucide-react'

interface Notificacao {
  id: string
  tipo: string
  canal: string
  destinatario: string
  mensagem: string
  status: 'enviado' | 'falhou' | 'pendente'
  cobranca_id?: string
  created_at: string
}

export default function NotificacoesPage() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'enviado' | 'falhou' | 'pendente'>('todos')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    fetchNotificacoes()
  }, [])

  const fetchNotificacoes = async () => {
    setLoading(true)
    // Mock data - in production would fetch from /api/notificacoes
    setNotificacoes([
      { id: '1', tipo: 'cobranca_vencendo', canal: 'whatsapp', destinatario: '5541999999999', mensagem: '⚠️ Olá! A cobrança "Mensalidade Jan" no valor de R$ 1.500,00 vence em 3 dias.', status: 'enviado', created_at: new Date().toISOString() },
      { id: '2', tipo: 'cobranca_atrasada', canal: 'whatsapp', destinatario: '5541988888888', mensagem: '🚨 A cobrança "Aluguel Fev" está atrasada! Valor: R$ 3.200,00.', status: 'enviado', created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: '3', tipo: 'cobranca_vencendo', canal: 'whatsapp', destinatario: '5541977777777', mensagem: '⚠️ Cobrança próxima do vencimento: "Fornecedor X" - R$ 850,00', status: 'falhou', created_at: new Date(Date.now() - 172800000).toISOString() },
      { id: '4', tipo: 'lembrete', canal: 'whatsapp', destinatario: '5541966666666', mensagem: '📋 Lembrete: Você tem 5 cobranças pendentes nesta semana.', status: 'enviado', created_at: new Date(Date.now() - 259200000).toISOString() },
      { id: '5', tipo: 'cobranca_atrasada', canal: 'whatsapp', destinatario: '5541955555555', mensagem: '🚨 Cobranças atrasadas detectadas! Verifique seu painel.', status: 'pendente', created_at: new Date(Date.now() - 345600000).toISOString() },
    ])
    setLoading(false)
  }

  const filtered = notificacoes.filter(n => {
    if (filtro !== 'todos' && n.status !== filtro) return false
    if (busca && !n.mensagem.toLowerCase().includes(busca.toLowerCase()) && !n.destinatario.includes(busca)) return false
    return true
  })

  const counts = {
    todos: notificacoes.length,
    enviado: notificacoes.filter(n => n.status === 'enviado').length,
    falhou: notificacoes.filter(n => n.status === 'falhou').length,
    pendente: notificacoes.filter(n => n.status === 'pendente').length,
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'enviado': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case 'falhou': return <XCircle className="w-4 h-4 text-red-400" />
      case 'pendente': return <Clock className="w-4 h-4 text-amber-400" />
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'enviado': return 'Enviado'
      case 'falhou': return 'Falhou'
      case 'pendente': return 'Pendente'
    }
  }

  const verificarCobrancas = async () => {
    try {
      const res = await fetch('/api/whatsapp/check-cobrancas', { method: 'POST' })
      const data = await res.json()
      alert(`Verificação concluída!\n${data.enviados || 0} notificações enviadas.`)
      fetchNotificacoes()
    } catch {
      alert('Erro ao verificar cobranças')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Notificações</h1>
          <p className="text-gray-500 text-sm mt-1">Histórico de mensagens WhatsApp enviadas</p>
        </div>
        <button onClick={verificarCobrancas} className="btn-primary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Verificar Cobranças Agora
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: counts.todos, color: 'text-gray-400', bg: 'bg-gray-500/10', filter: 'todos' as const },
          { label: 'Enviados', count: counts.enviado, color: 'text-emerald-400', bg: 'bg-emerald-500/10', filter: 'enviado' as const },
          { label: 'Falhas', count: counts.falhou, color: 'text-red-400', bg: 'bg-red-500/10', filter: 'falhou' as const },
          { label: 'Pendentes', count: counts.pendente, color: 'text-amber-400', bg: 'bg-amber-500/10', filter: 'pendente' as const },
        ].map(s => (
          <button key={s.label} onClick={() => setFiltro(s.filter)}
            className={`glass-card p-4 text-left transition-all ${filtro === s.filter ? 'ring-1 ring-indigo-500/30' : ''}`}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por mensagem ou destinatário..."
          className="w-full pl-10 pr-4 py-2.5 text-sm" />
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="glass-card h-64 shimmer" />
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-500">Nenhuma notificação encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(n => (
            <div key={n.id} className="glass-card p-4 hover:border-[#3a3a4a] transition-all">
              <div className="flex items-start gap-4">
                <div className="mt-0.5">
                  {statusIcon(n.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      n.status === 'enviado' ? 'bg-emerald-500/10 text-emerald-400' :
                      n.status === 'falhou' ? 'bg-red-500/10 text-red-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {statusLabel(n.status)}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {n.canal}
                    </span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-500">
                      {new Date(n.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-1">{n.mensagem}</p>
                  <p className="text-xs text-gray-600">Para: {n.destinatario}</p>
                </div>
                {n.status === 'falhou' && (
                  <button className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Reenviar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
