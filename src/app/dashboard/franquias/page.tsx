'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Search, Edit2, Trash2, MapPin, Phone, Mail, X } from 'lucide-react'
import type { Franquia } from '@/types/database'

export default function FranquiasPage() {
  const [franquias, setFranquias] = useState<Franquia[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingFranquia, setEditingFranquia] = useState<Franquia | null>(null)
  const [form, setForm] = useState({
    nome: '', cnpj: '', endereco: '', cidade: '', estado: '', telefone: '', email: '', responsavel: '', cor_tema: '#6366f1'
  })

  useEffect(() => { fetchFranquias() }, [])

  const fetchFranquias = async () => {
    try {
      const res = await fetch('/api/franquias')
      const data = await res.json()
      setFranquias(Array.isArray(data) ? data : [])
    } catch { setFranquias([]) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editingFranquia ? `/api/franquias/${editingFranquia.id}` : '/api/franquias'
    const method = editingFranquia ? 'PUT' : 'POST'
    
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setShowModal(false)
    setEditingFranquia(null)
    setForm({ nome: '', cnpj: '', endereco: '', cidade: '', estado: '', telefone: '', email: '', responsavel: '', cor_tema: '#6366f1' })
    fetchFranquias()
  }

  const handleEdit = (f: Franquia) => {
    setEditingFranquia(f)
    setForm({
      nome: f.nome, cnpj: f.cnpj || '', endereco: f.endereco || '', cidade: f.cidade || '',
      estado: f.estado || '', telefone: f.telefone || '', email: f.email || '', responsavel: f.responsavel || '', cor_tema: f.cor_tema
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja desativar esta franquia?')) return
    await fetch(`/api/franquias/${id}`, { method: 'DELETE' })
    fetchFranquias()
  }

  const filteredFranquias = franquias.filter(f => 
    f.ativa && (f.nome.toLowerCase().includes(search.toLowerCase()) || f.cnpj?.includes(search))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Franquias</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie suas unidades de negócio</p>
        </div>
        <button onClick={() => { setEditingFranquia(null); setForm({ nome: '', cnpj: '', endereco: '', cidade: '', estado: '', telefone: '', email: '', responsavel: '', cor_tema: '#6366f1' }); setShowModal(true) }} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Franquia
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou CNPJ..." className="w-full pl-10 pr-4 py-2.5 text-sm" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="glass-card h-48 shimmer" />)}
        </div>
      ) : filteredFranquias.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhuma franquia encontrada</p>
          <p className="text-gray-600 text-sm mt-1">Clique em &quot;Nova Franquia&quot; para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFranquias.map((f) => (
            <div key={f.id} className="glass-card p-5 group hover:border-indigo-500/20 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: f.cor_tema }}>
                    {f.nome.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{f.nome}</h3>
                    {f.cnpj && <p className="text-xs text-gray-500">{f.cnpj}</p>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(f)} className="p-1.5 rounded-lg hover:bg-[#1c1c28] text-gray-400 hover:text-indigo-400">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(f.id)} className="p-1.5 rounded-lg hover:bg-[#1c1c28] text-gray-400 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {f.responsavel && <div className="flex items-center gap-2 text-gray-400"><span className="text-gray-500">Resp:</span> {f.responsavel}</div>}
                {f.cidade && <div className="flex items-center gap-2 text-gray-400"><MapPin className="w-3.5 h-3.5 text-gray-600" /> {f.cidade}{f.estado ? ` - ${f.estado}` : ''}</div>}
                {f.telefone && <div className="flex items-center gap-2 text-gray-400"><Phone className="w-3.5 h-3.5 text-gray-600" /> {f.telefone}</div>}
                {f.email && <div className="flex items-center gap-2 text-gray-400"><Mail className="w-3.5 h-3.5 text-gray-600" /> {f.email}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editingFranquia ? 'Editar Franquia' : 'Nova Franquia'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-xs text-gray-400 mb-1">Nome *</label><input type="text" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} className="w-full px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs text-gray-400 mb-1">CNPJ</label><input type="text" value={form.cnpj} onChange={(e) => setForm({...form, cnpj: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Responsável</label><input type="text" value={form.responsavel} onChange={(e) => setForm({...form, responsavel: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                <div className="col-span-2"><label className="block text-xs text-gray-400 mb-1">Endereço</label><input type="text" value={form.endereco} onChange={(e) => setForm({...form, endereco: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Cidade</label><input type="text" value={form.cidade} onChange={(e) => setForm({...form, cidade: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Estado</label><input type="text" value={form.estado} onChange={(e) => setForm({...form, estado: e.target.value})} className="w-full px-3 py-2 text-sm" maxLength={2} /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Telefone</label><input type="text" value={form.telefone} onChange={(e) => setForm({...form, telefone: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Cor do tema</label><input type="color" value={form.cor_tema} onChange={(e) => setForm({...form, cor_tema: e.target.value})} className="w-full h-10 cursor-pointer" /></div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm">{editingFranquia ? 'Salvar' : 'Criar Franquia'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
