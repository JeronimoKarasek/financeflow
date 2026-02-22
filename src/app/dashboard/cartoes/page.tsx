'use client'

import { useState, useEffect } from 'react'
import { Plus, CreditCard, X, Pencil, Trash2, Eye, Calendar, DollarSign, Building2, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface CartaoCredito {
  id: string
  nome: string
  bandeira: string
  banco: string | null
  ultimos_digitos: string | null
  limite_total: number
  limite_usado: number
  dia_fechamento: number
  dia_vencimento: number
  cor: string
  conta_bancaria_id: string | null
  franquia_id: string | null
  is_pessoal: boolean
  ativo: boolean
  _financeiro_contas_bancarias?: { nome: string; banco: string } | null
}

interface ContaBancaria {
  id: string
  nome: string
  banco: string | null
}

interface FaturaResumo {
  cartao_credito_id: string
  mes_referencia: number
  ano_referencia: number
  valor_total: number
  status: string
  data_vencimento: string
}

interface Transacao {
  id: string
  descricao: string
  valor: number
  data_vencimento: string
  tipo: string
  _financeiro_categorias?: { nome: string; cor: string; icone: string } | null
}

const bandeiras = [
  { value: 'visa', label: 'Visa', color: '#1a1f71' },
  { value: 'mastercard', label: 'Mastercard', color: '#eb001b' },
  { value: 'elo', label: 'Elo', color: '#00a4e0' },
  { value: 'amex', label: 'American Express', color: '#006fcf' },
  { value: 'hipercard', label: 'Hipercard', color: '#822124' },
  { value: 'diners', label: 'Diners Club', color: '#004c97' },
]

const bancos = [
  'Nubank', 'Inter', 'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil',
  'Caixa', 'C6 Bank', 'BTG Pactual', 'Original', 'Pan', 'Neon',
  'Sicoob', 'Sicredi', 'Safra', 'Next', 'Outro',
]

const cores = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#1e1e1e', '#71717a', '#0ea5e9', '#d946ef',
]

export default function CartoesPage() {
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [selectedCartao, setSelectedCartao] = useState<string | null>(null)
  const [faturaTransacoes, setFaturaTransacoes] = useState<Transacao[]>([])
  const [faturaTotal, setFaturaTotal] = useState(0)
  const [faturaLoading, setFaturaLoading] = useState(false)
  const [faturaMes, setFaturaMes] = useState(new Date().getMonth() + 1)
  const [faturaAno, setFaturaAno] = useState(new Date().getFullYear())

  const [form, setForm] = useState({
    nome: '', bandeira: 'visa', banco: '', ultimos_digitos: '',
    limite_total: '', dia_fechamento: '1', dia_vencimento: '10',
    cor: '#6366f1', conta_bancaria_id: '', is_pessoal: false,
  })

  useEffect(() => {
    fetchCartoes()
    fetchContas()
  }, [])

  const fetchCartoes = async () => {
    try {
      const res = await fetch('/api/cartoes')
      const data = await res.json()
      setCartoes(Array.isArray(data) ? data : [])
    } catch { setCartoes([]) }
    finally { setLoading(false) }
  }

  const fetchContas = async () => {
    try {
      const res = await fetch('/api/contas')
      const data = await res.json()
      setContas(Array.isArray(data) ? data : [])
    } catch { setContas([]) }
  }

  const fetchFatura = async (cartaoId: string, mes: number, ano: number) => {
    setFaturaLoading(true)
    try {
      const res = await fetch('/api/cartoes/faturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartao_id: cartaoId, mes, ano }),
      })
      const data = await res.json()
      setFaturaTransacoes(data.transacoes || [])
      setFaturaTotal(data.total || 0)
    } catch {
      setFaturaTransacoes([])
      setFaturaTotal(0)
    }
    finally { setFaturaLoading(false) }
  }

  const resetForm = () => setForm({
    nome: '', bandeira: 'visa', banco: '', ultimos_digitos: '',
    limite_total: '', dia_fechamento: '1', dia_vencimento: '10',
    cor: '#6366f1', conta_bancaria_id: '', is_pessoal: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ...form,
      limite_total: parseFloat(form.limite_total),
      dia_fechamento: parseInt(form.dia_fechamento),
      dia_vencimento: parseInt(form.dia_vencimento),
    }

    if (editingId) {
      await fetch('/api/cartoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, id: editingId }),
      })
    } else {
      await fetch('/api/cartoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setShowModal(false)
    setEditingId(null)
    resetForm()
    fetchCartoes()
  }

  const handleEdit = (c: CartaoCredito) => {
    setEditingId(c.id)
    setForm({
      nome: c.nome, bandeira: c.bandeira, banco: c.banco || '',
      ultimos_digitos: c.ultimos_digitos || '',
      limite_total: String(c.limite_total),
      dia_fechamento: String(c.dia_fechamento),
      dia_vencimento: String(c.dia_vencimento),
      cor: c.cor, conta_bancaria_id: c.conta_bancaria_id || '',
      is_pessoal: c.is_pessoal,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/cartoes?id=${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    fetchCartoes()
  }

  const handleViewFatura = (cartaoId: string) => {
    setSelectedCartao(cartaoId)
    const m = new Date().getMonth() + 1
    const a = new Date().getFullYear()
    setFaturaMes(m)
    setFaturaAno(a)
    fetchFatura(cartaoId, m, a)
  }

  const getBandeiraIcon = (bandeira: string) => {
    const map: Record<string, string> = {
      visa: '💳', mastercard: '🔴', elo: '🔵', amex: '💠', hipercard: '🟥', diners: '🔷',
    }
    return map[bandeira] || '💳'
  }

  const limiteDisponivel = (c: CartaoCredito) => c.limite_total - c.limite_usado
  const percentualUsado = (c: CartaoCredito) => c.limite_total > 0 ? (c.limite_usado / c.limite_total) * 100 : 0

  const totalLimite = cartoes.reduce((s, c) => s + Number(c.limite_total), 0)
  const totalUsado = cartoes.reduce((s, c) => s + Number(c.limite_usado), 0)
  const totalDisponivel = totalLimite - totalUsado

  const mesesNome = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cartões de Crédito</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie seus cartões, limites e faturas</p>
        </div>
        <button onClick={() => { resetForm(); setEditingId(null); setShowModal(true) }} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Novo Cartão
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 border border-indigo-500/20">
          <p className="text-xs text-gray-500 mb-1">Limite Total</p>
          <p className="text-xl font-bold text-indigo-400">{formatCurrency(totalLimite)}</p>
        </div>
        <div className="glass-card p-4 border border-red-500/20">
          <p className="text-xs text-gray-500 mb-1">Utilizado</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(totalUsado)}</p>
        </div>
        <div className="glass-card p-4 border border-emerald-500/20">
          <p className="text-xs text-gray-500 mb-1">Disponível</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalDisponivel)}</p>
        </div>
      </div>

      {/* Cartões Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-6 h-52"><div className="h-full shimmer rounded-lg" /></div>
          ))}
        </div>
      ) : cartoes.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum cartão cadastrado</p>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm mt-4">Cadastrar Cartão</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cartoes.map(c => (
            <div key={c.id} className="glass-card overflow-hidden group">
              {/* Card visual - simula o cartão */}
              <div className="p-5 relative" style={{ background: `linear-gradient(135deg, ${c.cor}22, ${c.cor}08)` }}>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-sm font-bold text-white">{c.nome}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{c.banco || 'Sem banco'}</p>
                  </div>
                  <span className="text-2xl">{getBandeiraIcon(c.bandeira)}</span>
                </div>

                <p className="text-lg font-mono text-gray-300 tracking-widest mb-4">
                  •••• •••• •••• {c.ultimos_digitos || '****'}
                </p>

                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>Fecha dia {c.dia_fechamento} | Vence dia {c.dia_vencimento}</span>
                  <span className="capitalize">{bandeiras.find(b => b.value === c.bandeira)?.label}</span>
                </div>
              </div>

              {/* Barra de uso do limite */}
              <div className="px-5 py-3 border-t border-[#2a2a3a]">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-400">Limite usado</span>
                  <span className="text-gray-300 font-medium">{formatCurrency(Number(c.limite_usado))} / {formatCurrency(Number(c.limite_total))}</span>
                </div>
                <div className="w-full h-2 bg-[#1c1c28] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(percentualUsado(c), 100)}%`,
                      backgroundColor: percentualUsado(c) > 80 ? '#ef4444' : percentualUsado(c) > 50 ? '#f59e0b' : c.cor,
                    }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Disponível: <span className="text-emerald-400 font-medium">{formatCurrency(limiteDisponivel(c))}</span>
                </p>
              </div>

              {/* Ações */}
              <div className="flex border-t border-[#2a2a3a] divide-x divide-[#2a2a3a]">
                <button onClick={() => handleViewFatura(c.id)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-indigo-400 hover:bg-indigo-500/5 transition-colors">
                  <Eye className="w-3.5 h-3.5" /> Fatura
                </button>
                <button onClick={() => handleEdit(c)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-gray-400 hover:bg-[#1c1c28] transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => setDeleteConfirm(c.id)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/5 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Fatura */}
      {selectedCartao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCartao(null)} />
          <div className="relative w-full max-w-2xl glass-card p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Fatura do Cartão</h2>
                <p className="text-sm text-gray-400">{cartoes.find(c => c.id === selectedCartao)?.nome}</p>
              </div>
              <button onClick={() => setSelectedCartao(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Navegação de meses */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <button onClick={() => {
                const m = faturaMes === 1 ? 12 : faturaMes - 1
                const a = faturaMes === 1 ? faturaAno - 1 : faturaAno
                setFaturaMes(m); setFaturaAno(a)
                fetchFatura(selectedCartao, m, a)
              }} className="text-gray-400 hover:text-white p-1"><ChevronRight className="w-5 h-5 rotate-180" /></button>
              <span className="text-white font-medium min-w-[160px] text-center">{mesesNome[faturaMes]} {faturaAno}</span>
              <button onClick={() => {
                const m = faturaMes === 12 ? 1 : faturaMes + 1
                const a = faturaMes === 12 ? faturaAno + 1 : faturaAno
                setFaturaMes(m); setFaturaAno(a)
                fetchFatura(selectedCartao, m, a)
              }} className="text-gray-400 hover:text-white p-1"><ChevronRight className="w-5 h-5" /></button>
            </div>

            {/* Total da fatura */}
            <div className="glass-card p-4 border border-red-500/20 mb-4">
              <p className="text-xs text-gray-500 mb-1">Total da Fatura</p>
              <p className="text-2xl font-bold text-red-400">{formatCurrency(faturaTotal)}</p>
            </div>

            {/* Lista de gastos */}
            {faturaLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 shimmer rounded-lg" />)}</div>
            ) : faturaTransacoes.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhum gasto nesta fatura</p>
            ) : (
              <div className="space-y-2">
                {faturaTransacoes.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{t._financeiro_categorias?.icone || '📋'}</span>
                      <div>
                        <p className="text-sm text-gray-200">{t.descricao}</p>
                        <p className="text-[10px] text-gray-500">{new Date(t.data_vencimento).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-red-400">-{formatCurrency(Number(t.valor))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Novo/Editar Cartão */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editingId ? 'Editar Cartão' : 'Novo Cartão'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null) }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-xs text-gray-400 mb-1">Nome do Cartão *</label>
                <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full px-3 py-2 text-sm" placeholder="Ex: Nubank Ultravioleta" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Bandeira *</label>
                  <select value={form.bandeira} onChange={e => setForm({...form, bandeira: e.target.value})} className="w-full px-3 py-2 text-sm">
                    {bandeiras.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Banco</label>
                  <select value={form.banco} onChange={e => setForm({...form, banco: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="">Selecione</option>
                    {bancos.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Últimos 4 dígitos</label>
                  <input type="text" maxLength={4} value={form.ultimos_digitos} onChange={e => setForm({...form, ultimos_digitos: e.target.value.replace(/\D/g, '')})} className="w-full px-3 py-2 text-sm" placeholder="1234" />
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Limite Total *</label>
                  <input type="number" step="0.01" value={form.limite_total} onChange={e => setForm({...form, limite_total: e.target.value})} className="w-full px-3 py-2 text-sm" placeholder="5000.00" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Dia Fechamento *</label>
                  <input type="number" min="1" max="31" value={form.dia_fechamento} onChange={e => setForm({...form, dia_fechamento: e.target.value})} className="w-full px-3 py-2 text-sm" required />
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Dia Vencimento *</label>
                  <input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({...form, dia_vencimento: e.target.value})} className="w-full px-3 py-2 text-sm" required />
                </div>
              </div>

              <div><label className="block text-xs text-gray-400 mb-1">Conta para Pagamento da Fatura</label>
                <select value={form.conta_bancaria_id} onChange={e => setForm({...form, conta_bancaria_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                  <option value="">Nenhuma</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome} - {c.banco}</option>)}
                </select>
              </div>

              {/* Cor */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {cores.map(cor => (
                    <button key={cor} type="button" onClick={() => setForm({...form, cor})}
                      className={`w-7 h-7 rounded-lg transition-all ${form.cor === cor ? 'ring-2 ring-white ring-offset-2 ring-offset-[#16161f] scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: cor }} />
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input type="checkbox" checked={form.is_pessoal} onChange={e => setForm({...form, is_pessoal: e.target.checked})} className="w-4 h-4 rounded" />
                Cartão Pessoal
              </label>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null) }} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm">{editingId ? 'Salvar' : 'Cadastrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative w-full max-w-sm glass-card p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Excluir Cartão</h3>
                <p className="text-sm text-gray-400">Tem certeza? O cartão será desativado.</p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 text-sm px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors font-medium">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
