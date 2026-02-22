'use client'

import { useState, useEffect } from 'react'
import { Wallet, Plus, TrendingUp, TrendingDown, CreditCard, PiggyBank, X } from 'lucide-react'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils'
import type { Transacao, ContaBancaria, Categoria } from '@/types/database'

export default function PessoalPage() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [showModalTransacao, setShowModalTransacao] = useState(false)
  const [showModalConta, setShowModalConta] = useState(false)
  const [formTransacao, setFormTransacao] = useState({
    tipo: 'despesa', descricao: '', valor: '', data_vencimento: new Date().toISOString().split('T')[0],
    status: 'pago', categoria_id: '', conta_bancaria_id: '', is_pessoal: true, observacoes: '',
  })
  const [formConta, setFormConta] = useState({
    nome: '', banco: '', tipo: 'corrente', saldo_inicial: '', cor: '#6366f1', is_pessoal: true,
  })

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    try {
      const [resT, resC, resCat] = await Promise.all([
        fetch('/api/transacoes?is_pessoal=true'),
        fetch('/api/contas'),
        fetch('/api/categorias'),
      ])
      const transData = await resT.json()
      const contasData = await resC.json()
      const catData = await resCat.json()
      setTransacoes(transData.data || [])
      setContas((Array.isArray(contasData) ? contasData : []).filter((c: ContaBancaria) => c.is_pessoal))
      setCategorias(Array.isArray(catData) ? catData : [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const handleSubmitTransacao = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/transacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formTransacao, valor: parseFloat(formTransacao.valor) }),
    })
    setShowModalTransacao(false)
    fetchAll()
  }

  const handleSubmitConta = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formConta, saldo_inicial: parseFloat(formConta.saldo_inicial || '0') }),
    })
    setShowModalConta(false)
    fetchAll()
  }

  const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual), 0)
  const receitasMes = transacoes.filter(t => t.tipo === 'receita' && t.status === 'pago').reduce((s, t) => s + Number(t.valor), 0)
  const despesasMes = transacoes.filter(t => t.tipo === 'despesa' && t.status === 'pago').reduce((s, t) => s + Number(t.valor), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Finanças Pessoais</h1>
          <p className="text-gray-500 text-sm mt-1">Controle suas finanças pessoais</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowModalConta(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4" /> Nova Conta
          </button>
          <button onClick={() => setShowModalTransacao(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Transação
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 border border-indigo-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase">Saldo Total</span>
            <PiggyBank className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(saldoTotal)}</p>
        </div>
        <div className="glass-card p-5 border border-emerald-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase">Receitas</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(receitasMes)}</p>
        </div>
        <div className="glass-card p-5 border border-red-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase">Despesas</span>
            <TrendingDown className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(despesasMes)}</p>
        </div>
        <div className="glass-card p-5 border border-purple-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase">Contas</span>
            <CreditCard className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-400">{contas.length}</p>
        </div>
      </div>

      {/* Contas Bancárias */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Minhas Contas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contas.map(c => (
            <div key={c.id} className="glass-card p-4 hover:border-indigo-500/20 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: c.cor }}>
                  {c.nome.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200">{c.nome}</p>
                  <p className="text-xs text-gray-500">{c.banco} · {c.tipo}</p>
                </div>
              </div>
              <p className={`text-lg font-bold ${Number(c.saldo_atual) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(Number(c.saldo_atual))}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Últimas Transações Pessoais</h2>
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="space-y-3 p-4">{[...Array(3)].map((_, i) => <div key={i} className="h-12 shimmer rounded" />)}</div>
          ) : transacoes.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Nenhuma transação pessoal ainda</div>
          ) : (
            <div className="divide-y divide-[#1c1c28]">
              {transacoes.slice(0, 10).map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 table-row-hover">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.tipo === 'receita' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      {t.tipo === 'receita' ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                    </div>
                    <div>
                      <p className="text-sm text-gray-200">{t.descricao}</p>
                      <p className="text-xs text-gray-500">{formatDate(t.data_vencimento)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${t.tipo === 'receita' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.tipo === 'receita' ? '+' : '-'}{formatCurrency(Number(t.valor))}
                    </span>
                    <span className={`block text-[10px] ${getStatusColor(t.status).split(' ')[0]}`}>{getStatusLabel(t.status)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Transação */}
      {showModalTransacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModalTransacao(false)} />
          <div className="relative w-full max-w-md glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Transação Pessoal</h2>
              <button onClick={() => setShowModalTransacao(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitTransacao} className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setFormTransacao({...formTransacao, tipo: 'receita'})} className={`flex-1 py-2 rounded-lg text-sm border ${formTransacao.tipo === 'receita' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'border-[#2a2a3a] text-gray-400'}`}>Receita</button>
                <button type="button" onClick={() => setFormTransacao({...formTransacao, tipo: 'despesa'})} className={`flex-1 py-2 rounded-lg text-sm border ${formTransacao.tipo === 'despesa' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'border-[#2a2a3a] text-gray-400'}`}>Despesa</button>
              </div>
              <div><label className="block text-xs text-gray-400 mb-1">Descrição</label><input type="text" value={formTransacao.descricao} onChange={(e) => setFormTransacao({...formTransacao, descricao: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Valor</label><input type="number" step="0.01" value={formTransacao.valor} onChange={(e) => setFormTransacao({...formTransacao, valor: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Data</label><input type="date" value={formTransacao.data_vencimento} onChange={(e) => setFormTransacao({...formTransacao, data_vencimento: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Categoria</label>
                  <select value={formTransacao.categoria_id} onChange={(e) => setFormTransacao({...formTransacao, categoria_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="">Selecione</option>
                    {categorias.filter(c => c.tipo === formTransacao.tipo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Conta</label>
                  <select value={formTransacao.conta_bancaria_id} onChange={(e) => setFormTransacao({...formTransacao, conta_bancaria_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="">Selecione</option>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModalTransacao(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Conta */}
      {showModalConta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModalConta(false)} />
          <div className="relative w-full max-w-md glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Nova Conta Pessoal</h2>
              <button onClick={() => setShowModalConta(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitConta} className="space-y-4">
              <div><label className="block text-xs text-gray-400 mb-1">Nome</label><input type="text" value={formConta.nome} onChange={(e) => setFormConta({...formConta, nome: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Banco</label><input type="text" value={formConta.banco} onChange={(e) => setFormConta({...formConta, banco: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Tipo</label>
                  <select value={formConta.tipo} onChange={(e) => setFormConta({...formConta, tipo: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="corrente">Corrente</option>
                    <option value="poupanca">Poupança</option>
                    <option value="investimento">Investimento</option>
                    <option value="carteira_digital">Carteira Digital</option>
                    <option value="caixa">Caixa</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Saldo Inicial</label><input type="number" step="0.01" value={formConta.saldo_inicial} onChange={(e) => setFormConta({...formConta, saldo_inicial: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Cor</label><input type="color" value={formConta.cor} onChange={(e) => setFormConta({...formConta, cor: e.target.value})} className="w-full h-10 cursor-pointer" /></div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModalConta(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm">Criar Conta</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
