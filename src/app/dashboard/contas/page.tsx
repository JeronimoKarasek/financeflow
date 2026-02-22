'use client'

import { useState, useEffect } from 'react'
import { Plus, CreditCard, X, Edit2, Trash2, Building2, Wallet, PiggyBank, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { ContaBancaria, Franquia } from '@/types/database'

const TIPOS_CONTA = [
  { value: 'corrente', label: 'Conta Corrente', icon: '🏦' },
  { value: 'poupanca', label: 'Poupança', icon: '🐷' },
  { value: 'investimento', label: 'Investimento', icon: '📈' },
  { value: 'carteira_digital', label: 'Carteira Digital', icon: '📱' },
  { value: 'caixa', label: 'Caixa', icon: '💵' },
]

const BANCOS = [
  'Nubank', 'Inter', 'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil',
  'Caixa Econômica', 'C6 Bank', 'PagBank', 'Sicredi', 'Sicoob',
  'BTG Pactual', 'Mercado Pago', 'PicPay', 'Stone', 'Safra', 'Outro',
]

const CORES = ['#ef4444','#f97316','#f59e0b','#22c55e','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899']

export default function ContasBancariasPage() {
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [franquias, setFranquias] = useState<Franquia[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<ContaBancaria | null>(null)
  const [form, setForm] = useState({
    nome: '', banco: '', agencia: '', numero_conta: '',
    tipo: 'corrente', saldo_inicial: '', cor: '#6366f1',
    franquia_id: '', is_pessoal: false,
  })

  useEffect(() => {
    Promise.all([fetchContas(), fetchFranquias()])
  }, [])

  const fetchContas = async () => {
    try {
      const res = await fetch('/api/contas')
      const data = await res.json()
      setContas(Array.isArray(data) ? data : [])
    } catch { setContas([]) }
    finally { setLoading(false) }
  }

  const fetchFranquias = async () => {
    try {
      const res = await fetch('/api/franquias')
      const data = await res.json()
      setFranquias(Array.isArray(data) ? data.filter((f: Franquia) => f.ativa) : [])
    } catch { setFranquias([]) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ...form,
      saldo_inicial: parseFloat(form.saldo_inicial || '0'),
      franquia_id: form.franquia_id || null,
    }

    if (editando) {
      await fetch('/api/contas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editando.id, ...payload }),
      })
    } else {
      await fetch('/api/contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setShowModal(false)
    setEditando(null)
    resetForm()
    fetchContas()
  }

  const handleEdit = (conta: ContaBancaria) => {
    setEditando(conta)
    setForm({
      nome: conta.nome, banco: conta.banco || '', agencia: conta.agencia || '',
      numero_conta: conta.numero_conta || '', tipo: conta.tipo,
      saldo_inicial: String(conta.saldo_inicial), cor: conta.cor,
      franquia_id: conta.franquia_id || '', is_pessoal: conta.is_pessoal,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Desativar esta conta bancária?')) return
    await fetch(`/api/contas?id=${id}`, { method: 'DELETE' })
    fetchContas()
  }

  const resetForm = () => setForm({
    nome: '', banco: '', agencia: '', numero_conta: '',
    tipo: 'corrente', saldo_inicial: '', cor: '#6366f1',
    franquia_id: '', is_pessoal: false,
  })

  const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual), 0)
  const contasPessoais = contas.filter(c => c.is_pessoal)
  const contasEmpresa = contas.filter(c => !c.is_pessoal)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Contas Bancárias</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie suas contas e saldos</p>
        </div>
        <button onClick={() => { resetForm(); setEditando(null); setShowModal(true) }} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Conta
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 border border-indigo-500/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Saldo Total</p>
            <Wallet className="w-4 h-4 text-indigo-400" />
          </div>
          <p className={`text-xl font-bold ${saldoTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(saldoTotal)}</p>
        </div>
        <div className="glass-card p-4 border border-blue-500/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Total de Contas</p>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold text-white">{contas.length}</p>
        </div>
        <div className="glass-card p-4 border border-purple-500/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Contas Pessoais</p>
            <PiggyBank className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-xl font-bold text-white">{contasPessoais.length}</p>
        </div>
        <div className="glass-card p-4 border border-emerald-500/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Contas Empresa</p>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-white">{contasEmpresa.length}</p>
        </div>
      </div>

      {/* Grid de contas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="glass-card p-5 shimmer h-40 rounded-lg" />)
        ) : contas.length === 0 ? (
          <div className="col-span-full glass-card p-12 text-center text-gray-500">
            Nenhuma conta bancária cadastrada
          </div>
        ) : (
          contas.map(conta => {
            const tipoInfo = TIPOS_CONTA.find(t => t.value === conta.tipo) || TIPOS_CONTA[0]
            return (
              <div key={conta.id} className="glass-card p-5 border-l-4 transition-all hover:shadow-lg hover:shadow-black/20" style={{ borderLeftColor: conta.cor }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: conta.cor + '15' }}>
                      {tipoInfo.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{conta.nome}</p>
                      <p className="text-xs text-gray-500">{conta.banco || 'Sem banco'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(conta)} className="p-1.5 text-gray-500 hover:text-white rounded transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(conta.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Saldo Atual</p>
                    <p className={`text-lg font-bold ${Number(conta.saldo_atual) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(Number(conta.saldo_atual))}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{tipoInfo.label}</span>
                    <div className="flex gap-2">
                      {conta.agencia && <span>Ag: {conta.agencia}</span>}
                      {conta.numero_conta && <span>Cc: {conta.numero_conta}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {conta.is_pessoal && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">pessoal</span>}
                    {!conta.is_pessoal && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">empresa</span>}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowModal(false); setEditando(null) }} />
          <div className="relative w-full max-w-lg glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editando ? 'Editar Conta' : 'Nova Conta Bancária'}</h2>
              <button onClick={() => { setShowModal(false); setEditando(null) }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nome da Conta *</label>
                <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Nubank Principal" className="w-full px-3 py-2 text-sm" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Banco</label>
                  <select value={form.banco} onChange={e => setForm({...form, banco: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="">Selecione</option>
                    {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} className="w-full px-3 py-2 text-sm">
                    {TIPOS_CONTA.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Agência</label>
                  <input type="text" value={form.agencia} onChange={e => setForm({...form, agencia: e.target.value})} placeholder="0001" className="w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nº da Conta</label>
                  <input type="text" value={form.numero_conta} onChange={e => setForm({...form, numero_conta: e.target.value})} placeholder="12345-6" className="w-full px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Saldo Inicial</label>
                  <input type="number" step="0.01" value={form.saldo_inicial} onChange={e => setForm({...form, saldo_inicial: e.target.value})} placeholder="0.00" className="w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Franquia</label>
                  <select value={form.franquia_id} onChange={e => setForm({...form, franquia_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="">Nenhuma</option>
                    {franquias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* Cor */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {CORES.map(cor => (
                    <button key={cor} type="button" onClick={() => setForm({...form, cor})}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${form.cor === cor ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: cor }} />
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input type="checkbox" checked={form.is_pessoal} onChange={e => setForm({...form, is_pessoal: e.target.checked})} className="w-4 h-4 rounded" />
                Conta pessoal
              </label>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setEditando(null) }} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm">{editando ? 'Salvar' : 'Criar Conta'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
