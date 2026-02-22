'use client'

import { useState, useEffect } from 'react'
import { Bell, MessageSquare, CheckCircle2, XCircle, Clock, RefreshCw, Search } from 'lucide-react'

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
  const [reenviando, setReenviando] = useState<string | null>(null)

  useEffect(() => {
    fetchNotificacoes()
  }, [])

  const fetchNotificacoes = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notificacoes?limite=100')
      if (res.ok) {
        const data = await res.json()
        setNotificacoes(Array.isArray(data) ? data : [])
      } else {
        setNotificacoes([])
      }
    } catch {
      setNotificacoes([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = notificacoes.filter(n => {
    if (filtro !== 'todos' && n.status !== filtro) return false
    if (busca && !n.mensagem?.toLowerCase().includes(busca.toLowerCase()) && !n.destinatario?.includes(busca)) return false
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
      default: return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'enviado': return 'Enviado'
      case 'falhou': return 'Falhou'
      case 'pendente': return 'Pendente'
      default: return status
    }
  }

  const handleReenviar = async (notif: Notificacao) => {
    setReenviando(notif.id)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: notif.destinatario,
          mensagem: notif.mensagem,
        }),
      })
      if (res.ok) {
        alert('Mensagem reenviada com sucesso!')
        fetchNotificacoes()
      } else {
        const err = await res.json()
        alert(`Erro ao reenviar: ${err.error || 'Falha desconhecida'}`)
      }
    } catch {
      alert('Erro de conexão ao reenviar')
    } finally {
      setReenviando(null)
    }
  }

  const verificarCobrancas = async () => {
    try {
      const res = await fetch('/api/whatsapp/check-cobrancas', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        alert(`Verificação concluída!\n${data.enviados || 0} notificações enviadas.`)
        fetchNotificacoes()
      } else {
        alert('Erro ao verificar cobranças')
      }
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: counts.todos, color: 'text-gray-400', filter: 'todos' as const },
          { label: 'Enviados', count: counts.enviado, color: 'text-emerald-400', filter: 'enviado' as const },
          { label: 'Falhas', count: counts.falhou, color: 'text-red-400', filter: 'falhou' as const },
          { label: 'Pendentes', count: counts.pendente, color: 'text-amber-400', filter: 'pendente' as const },
        ].map(s => (
          <button key={s.label} onClick={() => setFiltro(s.filter)}
            className={`glass-card p-4 text-left transition-all ${filtro === s.filter ? 'ring-1 ring-indigo-500/30' : ''}`}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por mensagem ou destinatário..."
          className="w-full pl-10 pr-4 py-2.5 text-sm" />
      </div>

      {loading ? (
        <div className="glass-card h-64 shimmer" />
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-500">{notificacoes.length === 0 ? 'Nenhuma notificação enviada ainda. Use "Verificar Cobranças" para enviar alertas automáticos.' : 'Nenhuma notificação com este filtro'}</p>
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
                      <MessageSquare className="w-3 h-3" /> {n.canal || 'whatsapp'}
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
                  <button
                    onClick={() => handleReenviar(n)}
                    disabled={reenviando === n.id}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 whitespace-nowrap">
                    <RefreshCw className={`w-3 h-3 ${reenviando === n.id ? 'animate-spin' : ''}`} />
                    {reenviando === n.id ? 'Enviando...' : 'Reenviar'}
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
