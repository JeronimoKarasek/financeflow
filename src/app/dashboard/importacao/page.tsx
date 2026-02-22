'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, CreditCard, Building2, X, FileSpreadsheet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ContaBancaria {
  id: string
  nome: string
  banco: string | null
}

interface CartaoCredito {
  id: string
  nome: string
  bandeira: string
  banco: string | null
  ultimos_digitos: string | null
}

interface ImportResult {
  success: boolean
  importadas: number
  resumo: {
    total: number
    receitas: number
    despesas: number
    valor_receitas: number
    valor_despesas: number
  }
}

export default function ImportacaoPage() {
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [targetType, setTargetType] = useState<'conta' | 'cartao'>('conta')
  const [targetId, setTargetId] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([fetchContas(), fetchCartoes()])
  }, [])

  const fetchContas = async () => {
    try {
      const res = await fetch('/api/contas')
      const data = await res.json()
      setContas(Array.isArray(data) ? data : [])
    } catch { setContas([]) }
    finally { setLoading(false) }
  }

  const fetchCartoes = async () => {
    try {
      const res = await fetch('/api/cartoes')
      const data = await res.json()
      setCartoes(Array.isArray(data) ? data : [])
    } catch { setCartoes([]) }
  }

  const handleImport = async (file: File) => {
    if (!targetId) {
      setError('Selecione a conta ou cartão de destino antes de importar')
      return
    }

    const validExts = ['.csv', '.ofx', '.qfx', '.txt']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!validExts.includes(ext)) {
      setError('Formato não suportado. Use CSV, OFX, QFX ou TXT')
      return
    }

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('target_type', targetType)
      formData.append('target_id', targetId)

      const res = await fetch('/api/importacao', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao importar arquivo')
        return
      }

      setResult(data)
    } catch {
      setError('Erro ao processar o arquivo. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImport(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImport(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Importar Extrato</h1>
        <p className="text-gray-500 text-sm mt-1">Importe extratos bancários e faturas de cartão (CSV, OFX)</p>
      </div>

      {/* Seleção de destino */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">1. Selecione o destino</h2>

        {/* Tipo de destino */}
        <div className="flex gap-3">
          <button onClick={() => { setTargetType('conta'); setTargetId('') }}
            className={`flex-1 flex items-center gap-3 p-4 rounded-xl border transition-all ${
              targetType === 'conta' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'border-[#2a2a3a] text-gray-400 hover:bg-[#1c1c28]'
            }`}>
            <Building2 className="w-5 h-5" />
            <div className="text-left">
              <p className="text-sm font-medium">Conta Bancária</p>
              <p className="text-[10px] opacity-60">Extrato de conta corrente/poupança</p>
            </div>
          </button>
          <button onClick={() => { setTargetType('cartao'); setTargetId('') }}
            className={`flex-1 flex items-center gap-3 p-4 rounded-xl border transition-all ${
              targetType === 'cartao' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'border-[#2a2a3a] text-gray-400 hover:bg-[#1c1c28]'
            }`}>
            <CreditCard className="w-5 h-5" />
            <div className="text-left">
              <p className="text-sm font-medium">Cartão de Crédito</p>
              <p className="text-[10px] opacity-60">Fatura do cartão de crédito</p>
            </div>
          </button>
        </div>

        {/* Seleção específica */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            {targetType === 'conta' ? 'Conta Bancária' : 'Cartão de Crédito'} *
          </label>
          <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full px-3 py-2 text-sm">
            <option value="">Selecione...</option>
            {targetType === 'conta'
              ? contas.map(c => <option key={c.id} value={c.id}>{c.nome} - {c.banco}</option>)
              : cartoes.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.bandeira}) •••• {c.ultimos_digitos || '****'}</option>)
            }
          </select>
        </div>
      </div>

      {/* Upload Area */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">2. Envie o arquivo</h2>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragOver ? 'border-indigo-500 bg-indigo-500/5' :
            uploading ? 'border-yellow-500/30 bg-yellow-500/5' :
            'border-[#2a2a3a] hover:border-indigo-500/30 hover:bg-[#16161f]'
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".csv,.ofx,.qfx,.txt" onChange={handleFileSelect} className="hidden" />
          
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-yellow-500/30 border-t-yellow-400 animate-spin" />
              <p className="text-sm text-yellow-400">Processando arquivo...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-gray-200 font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-[11px] text-gray-500 mt-1">Formatos aceitos: CSV, OFX, QFX, TXT</p>
              </div>
            </div>
          )}
        </div>

        {/* Formatos ajuda */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-gray-200">CSV</p>
              <p className="text-[10px] text-gray-500">Colunas: Data, Descrição, Valor. Separador por ; ou ,</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
            <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-gray-200">OFX / QFX</p>
              <p className="text-[10px] text-gray-500">Formato padrão exportado pela maioria dos bancos</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
            <FileText className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-gray-200">TXT</p>
              <p className="text-[10px] text-gray-500">Arquivo texto com dados separados por tabulação</p>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado da importação */}
      {result && (
        <div className="glass-card p-6 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Importação concluída!</h3>
              <p className="text-xs text-gray-400">{result.importadas} transações importadas com sucesso</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-[#16161f]">
              <p className="text-[10px] text-gray-500 mb-1">Total</p>
              <p className="text-lg font-bold text-white">{result.resumo.total}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#16161f]">
              <p className="text-[10px] text-gray-500 mb-1 flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-emerald-400" /> Receitas</p>
              <p className="text-lg font-bold text-emerald-400">{result.resumo.receitas}</p>
              <p className="text-[10px] text-gray-500">{formatCurrency(result.resumo.valor_receitas)}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#16161f]">
              <p className="text-[10px] text-gray-500 mb-1 flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-400" /> Despesas</p>
              <p className="text-lg font-bold text-red-400">{result.resumo.despesas}</p>
              <p className="text-[10px] text-gray-500">{formatCurrency(result.resumo.valor_despesas)}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#16161f]">
              <p className="text-[10px] text-gray-500 mb-1">Resultado</p>
              <p className={`text-lg font-bold ${result.resumo.valor_receitas - result.resumo.valor_despesas >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(result.resumo.valor_receitas - result.resumo.valor_despesas)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="glass-card p-4 border border-red-500/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  )
}
