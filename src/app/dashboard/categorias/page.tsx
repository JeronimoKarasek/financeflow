'use client'

import { useState, useEffect } from 'react'
import { Plus, Tag, X, Edit2, Trash2, ChevronRight, Palette } from 'lucide-react'
import type { Categoria } from '@/types/database'

interface CategoriaComSub extends Categoria {
  parent_id?: string | null
  subcategorias?: CategoriaComSub[]
}

const CORES = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e']
const ICONES = ['📦','🏠','🚗','🍔','💰','📱','💻','🎓','🏥','✈️','🛒','📊','🔧','💡','🎯','📋','💳','🏦','📈','⚡']

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<CategoriaComSub[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<CategoriaComSub | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [form, setForm] = useState({
    nome: '', tipo: 'despesa' as string, cor: '#6366f1', icone: '📦',
    parent_id: '' as string, is_pessoal: false,
  })

  useEffect(() => { fetchCategorias() }, [])

  const fetchCategorias = async () => {
    try {
      const res = await fetch('/api/categorias')
      const data = await res.json()
      setCategorias(Array.isArray(data) ? data : [])
    } catch { setCategorias([]) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ...form,
      parent_id: form.parent_id || null,
    }

    if (editando) {
      await fetch('/api/categorias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editando.id, ...payload }),
      })
    } else {
      await fetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setShowModal(false)
    setEditando(null)
    resetForm()
    fetchCategorias()
  }

  const handleEdit = (cat: CategoriaComSub) => {
    setEditando(cat)
    setForm({
      nome: cat.nome, tipo: cat.tipo, cor: cat.cor, icone: cat.icone,
      parent_id: cat.parent_id || '', is_pessoal: cat.is_pessoal,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Desativar esta categoria?')) return
    await fetch(`/api/categorias?id=${id}`, { method: 'DELETE' })
    fetchCategorias()
  }

  const resetForm = () => setForm({
    nome: '', tipo: 'despesa', cor: '#6366f1', icone: '📦', parent_id: '', is_pessoal: false,
  })

  // Organizar em árvore: pais e filhos
  const pais = categorias.filter(c => !c.parent_id)
  const filhos = categorias.filter(c => c.parent_id)
  const arvore = pais.map(p => ({ ...p, subcategorias: filhos.filter(f => f.parent_id === p.id) }))

  const filtered = filtroTipo ? arvore.filter(c => c.tipo === filtroTipo) : arvore

  const totalReceita = categorias.filter(c => c.tipo === 'receita' && !c.parent_id).length
  const totalDespesa = categorias.filter(c => c.tipo === 'despesa' && !c.parent_id).length
  const totalSub = filhos.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Categorias</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie categorias e subcategorias</p>
        </div>
        <button onClick={() => { resetForm(); setEditando(null); setShowModal(true) }} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Categoria
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 border border-emerald-500/20">
          <p className="text-xs text-gray-500 mb-1">Receitas</p>
          <p className="text-xl font-bold text-emerald-400">{totalReceita}</p>
        </div>
        <div className="glass-card p-4 border border-red-500/20">
          <p className="text-xs text-gray-500 mb-1">Despesas</p>
          <p className="text-xl font-bold text-red-400">{totalDespesa}</p>
        </div>
        <div className="glass-card p-4 border border-indigo-500/20">
          <p className="text-xs text-gray-500 mb-1">Subcategorias</p>
          <p className="text-xl font-bold text-indigo-400">{totalSub}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="px-3 py-2 text-sm min-w-[150px]">
          <option value="">Todos os tipos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
        </select>
      </div>

      {/* Lista de categorias */}
      <div className="space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className="glass-card p-4 shimmer h-16 rounded-lg" />)
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center text-gray-500">Nenhuma categoria cadastrada</div>
        ) : (
          filtered.map(cat => (
            <div key={cat.id} className="glass-card overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: cat.cor + '20' }}>
                    {cat.icone}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{cat.nome}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${cat.tipo === 'receita' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {cat.tipo}
                      </span>
                      {cat.is_pessoal && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">pessoal</span>}
                    </div>
                    {cat.subcategorias && cat.subcategorias.length > 0 && (
                      <p className="text-xs text-gray-500">{cat.subcategorias.length} subcategoria(s)</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(cat)} className="p-2 text-gray-400 hover:text-white hover:bg-[#1c1c28] rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Subcategorias */}
              {cat.subcategorias && cat.subcategorias.length > 0 && (
                <div className="border-t border-[#2a2a3a]">
                  {cat.subcategorias.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between px-4 py-3 pl-12 border-b border-[#1c1c28] last:border-0">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-gray-600" />
                        <span className="text-sm" style={{ color: sub.cor }}>{sub.icone}</span>
                        <span className="text-sm text-gray-300">{sub.nome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(sub)} className="p-1.5 text-gray-500 hover:text-white rounded transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(sub.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowModal(false); setEditando(null) }} />
          <div className="relative w-full max-w-md glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editando ? 'Editar Categoria' : 'Nova Categoria'}</h2>
              <button onClick={() => { setShowModal(false); setEditando(null) }} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo */}
              <div className="flex gap-2">
                {[{v:'receita',l:'Receita'},{v:'despesa',l:'Despesa'}].map(t => (
                  <button key={t.v} type="button" onClick={() => setForm({...form, tipo: t.v})}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      form.tipo === t.v
                        ? t.v === 'receita' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
                        : 'border-[#2a2a3a] text-gray-400 hover:bg-[#1c1c28]'
                    }`}>
                    {t.l}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Nome *</label>
                <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full px-3 py-2 text-sm" required />
              </div>

              {/* Categoria pai (subcategoria) */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Categoria Pai (deixe vazio para categoria principal)</label>
                <select value={form.parent_id} onChange={e => setForm({...form, parent_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                  <option value="">— Categoria Principal —</option>
                  {pais.filter(p => p.tipo === form.tipo && p.id !== editando?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.icone} {p.nome}</option>
                  ))}
                </select>
              </div>

              {/* Ícone */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">Ícone</label>
                <div className="flex flex-wrap gap-2">
                  {ICONES.map(ic => (
                    <button key={ic} type="button" onClick={() => setForm({...form, icone: ic})}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-all ${
                        form.icone === ic ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#2a2a3a] hover:bg-[#1c1c28]'
                      }`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cor */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {CORES.map(cor => (
                    <button key={cor} type="button" onClick={() => setForm({...form, cor})}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        form.cor === cor ? 'border-white scale-110' : 'border-transparent'
                      }`} style={{ backgroundColor: cor }} />
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input type="checkbox" checked={form.is_pessoal} onChange={e => setForm({...form, is_pessoal: e.target.checked})} className="w-4 h-4 rounded" />
                Categoria pessoal
              </label>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setEditando(null) }} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm">{editando ? 'Salvar' : 'Criar Categoria'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
