'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, CreditCard, Building2, X, FileSpreadsheet, Download, Trash2, Clock, History, Repeat, Layers } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

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

interface Franquia {
  id: string
  nome: string
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
    parcelas_geradas?: number
    transacoes_fixas?: number
  }
}

interface ImportHistory {
  arquivo: string
  data_importacao: string
  total: number
  receitas: number
  despesas: number
  valor_receitas: number
  valor_despesas: number
  ids: string[]
}

type Tab = 'importar' | 'historico' | 'modelo'

export default function ImportacaoPage() {
  const [tab, setTab] = useState<Tab>('importar')
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [franquias, setFranquias] = useState<Franquia[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [targetType, setTargetType] = useState<'conta' | 'cartao'>('conta')
  const [targetId, setTargetId] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Histórico
  const [historico, setHistorico] = useState<ImportHistory[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchContas(), fetchCartoes(), fetchFranquias()])
  }, [])

  useEffect(() => {
    if (tab === 'historico') fetchHistorico()
  }, [tab])

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

  const fetchFranquias = async () => {
    try {
      const res = await fetch('/api/franquias')
      const data = await res.json()
      setFranquias(Array.isArray(data) ? data.filter((f: Franquia & { ativa?: boolean }) => f.ativa !== false) : [])
    } catch { setFranquias([]) }
  }

  const fetchHistorico = async () => {
    setLoadingHistorico(true)
    try {
      const res = await fetch('/api/importacao')
      const data = await res.json()
      setHistorico(Array.isArray(data) ? data : [])
    } catch { setHistorico([]) }
    finally { setLoadingHistorico(false) }
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

  const handleDeleteImport = async (item: ImportHistory) => {
    const key = `${item.arquivo}__${item.data_importacao}`
    if (!confirm(`Excluir ${item.total} transações importadas de "${item.arquivo}"? O saldo da conta será revertido.`)) return

    setDeletingId(key)
    try {
      const res = await fetch('/api/importacao', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: item.ids }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Erro ao excluir')
        return
      }
      fetchHistorico()
    } catch {
      alert('Erro de conexão')
    } finally {
      setDeletingId(null)
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

  const downloadTemplate = () => {
    const franquiaNomes = franquias.map(f => f.nome).join(' | ')
    const header = 'Data;Descricao;Valor;Tipo;Franquia;Parcela;Fixo'
    const exemplo1 = `${new Date().toLocaleDateString('pt-BR')};Compra Magazine Luiza;-500.00;despesa;${franquias[0]?.nome || 'Empresa A'};2/10;nao`
    const exemplo2 = `${new Date().toLocaleDateString('pt-BR')};Netflix Assinatura;-45.90;despesa;${franquias[1]?.nome || franquias[0]?.nome || 'Empresa A'};;sim`
    const exemplo3 = `${new Date().toLocaleDateString('pt-BR')};Aluguel escritorio;-2800.00;despesa;${franquias[0]?.nome || 'Empresa A'};;sim`
    const exemplo4 = `${new Date().toLocaleDateString('pt-BR')};Celular Samsung;-299.90;despesa;${franquias[1]?.nome || franquias[0]?.nome || 'Empresa B'};1/12;nao`
    const comentario = `\n# INSTRUCOES:\n# - Separador: ponto-e-virgula (;)\n# - Coluna "Data": formato dd/mm/aaaa ou aaaa-mm-dd\n# - Coluna "Valor": use ponto como decimal. Negativo = despesa\n# - Coluna "Tipo": receita ou despesa (se omitido, define pelo sinal do valor)\n# - Coluna "Franquia": nome EXATO da empresa/franquia cadastrada\n# - Coluna "Parcela": formato X/Y (ex: 2/10 = parcela 2 de 10). Gera parcelas restantes automaticamente\n# - Coluna "Fixo": sim ou nao. Se sim, marca como despesa fixa mensal (recorrente)\n# - Franquias cadastradas: ${franquiaNomes || '(nenhuma cadastrada)'}\n# - Para cartao: vencimento calculado automaticamente pelo dia de fechamento\n# - Remova estas linhas de comentario antes de importar`

    const csv = `${header}\n${exemplo1}\n${exemplo2}\n${exemplo3}\n${exemplo4}\n${comentario}`
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo_importacao_extrato.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'importar', label: 'Importar', icon: <Upload className="w-4 h-4" /> },
    { id: 'historico', label: 'Histórico', icon: <History className="w-4 h-4" /> },
    { id: 'modelo', label: 'Modelo', icon: <Download className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Importar Extrato</h1>
        <p className="text-gray-500 text-sm mt-1">Importe extratos bancários e faturas de cartão (CSV, OFX)</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#12121a] rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1c1c28]'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ========== TAB IMPORTAR ========== */}
      {tab === 'importar' && (
        <>
          {/* Seleção de destino */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white">1. Selecione o destino</h2>

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

            {/* Formatos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-gray-200">CSV</p>
                  <p className="text-[10px] text-gray-500">Data; Descrição; Valor; Tipo; Franquia; Parcela; Fixo</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
                <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-gray-200">OFX / QFX</p>
                  <p className="text-[10px] text-gray-500">Formato padrão exportado pelos bancos</p>
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

          {/* Resultado */}
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

              {/* Info de parcelas e fixas */}
              {(result.resumo.parcelas_geradas || result.resumo.transacoes_fixas) ? (
                <div className="flex gap-3 mt-3">
                  {result.resumo.parcelas_geradas ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs text-purple-300">{result.resumo.parcelas_geradas} parcelas futuras geradas</span>
                    </div>
                  ) : null}
                  {result.resumo.transacoes_fixas ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <Repeat className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-xs text-cyan-300">{result.resumo.transacoes_fixas} transações fixas mensais</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
        </>
      )}

      {/* ========== TAB HISTÓRICO ========== */}
      {tab === 'historico' && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3a]">
            <h2 className="text-sm font-semibold text-white">Histórico de Importações</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Arquivos importados anteriormente. Você pode excluir uma importação inteira.</p>
          </div>

          {loadingHistorico ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin mx-auto" />
            </div>
          ) : historico.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nenhuma importação registrada</p>
              <p className="text-gray-600 text-xs mt-1">Importe um arquivo CSV ou OFX para começar</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1c1c28]">
              {historico.map((item, i) => {
                const key = `${item.arquivo}__${item.data_importacao}`
                return (
                  <div key={i} className="px-5 py-4 flex items-center gap-4 hover:bg-[#16161f] transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{item.arquivo}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {formatDate(item.data_importacao)} &nbsp;·&nbsp;
                        {item.total} transações &nbsp;·&nbsp;
                        <span className="text-emerald-400">{item.receitas} receitas</span> &nbsp;·&nbsp;
                        <span className="text-red-400">{item.despesas} despesas</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-emerald-400">+{formatCurrency(item.valor_receitas)}</p>
                        <p className="text-xs text-red-400">-{formatCurrency(item.valor_despesas)}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteImport(item)}
                        disabled={deletingId === key}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Excluir toda a importação"
                      >
                        {deletingId === key ? (
                          <div className="w-4 h-4 rounded-full border-2 border-red-500/30 border-t-red-400 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========== TAB MODELO ========== */}
      {tab === 'modelo' && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Modelo de Planilha para Importação</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">Baixe o modelo, preencha e importe na aba &ldquo;Importar&rdquo;</p>
              </div>
              <button onClick={downloadTemplate} className="btn-primary flex items-center gap-2 text-sm">
                <Download className="w-4 h-4" /> Baixar Modelo CSV
              </button>
            </div>

            {/* Exemplo visual da planilha */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a3a]">
                    <th className="text-left px-3 py-2 text-indigo-400 font-semibold">Data</th>
                    <th className="text-left px-3 py-2 text-indigo-400 font-semibold">Descricao</th>
                    <th className="text-left px-3 py-2 text-indigo-400 font-semibold">Valor</th>
                    <th className="text-left px-3 py-2 text-indigo-400 font-semibold">Tipo</th>
                    <th className="text-left px-3 py-2 text-indigo-400 font-semibold">Franquia</th>
                    <th className="text-left px-3 py-2 text-purple-400 font-semibold">Parcela</th>
                    <th className="text-left px-3 py-2 text-cyan-400 font-semibold">Fixo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#1c1c28]">
                    <td className="px-3 py-2 text-gray-300">26/02/2026</td>
                    <td className="px-3 py-2 text-gray-300">Compra Magazine Luiza</td>
                    <td className="px-3 py-2 text-red-400">-500.00</td>
                    <td className="px-3 py-2 text-gray-400">despesa</td>
                    <td className="px-3 py-2 text-amber-400">{franquias[0]?.nome || 'Empresa A'}</td>
                    <td className="px-3 py-2 text-purple-400">2/10</td>
                    <td className="px-3 py-2 text-gray-500">nao</td>
                  </tr>
                  <tr className="border-b border-[#1c1c28]">
                    <td className="px-3 py-2 text-gray-300">26/02/2026</td>
                    <td className="px-3 py-2 text-gray-300">Netflix Assinatura</td>
                    <td className="px-3 py-2 text-red-400">-45.90</td>
                    <td className="px-3 py-2 text-gray-400">despesa</td>
                    <td className="px-3 py-2 text-amber-400">{franquias[1]?.nome || franquias[0]?.nome || 'Empresa B'}</td>
                    <td className="px-3 py-2 text-gray-600">-</td>
                    <td className="px-3 py-2 text-cyan-400">sim</td>
                  </tr>
                  <tr className="border-b border-[#1c1c28]">
                    <td className="px-3 py-2 text-gray-300">25/02/2026</td>
                    <td className="px-3 py-2 text-gray-300">Celular Samsung</td>
                    <td className="px-3 py-2 text-red-400">-299.90</td>
                    <td className="px-3 py-2 text-gray-400">despesa</td>
                    <td className="px-3 py-2 text-amber-400">{franquias[0]?.nome || 'Empresa A'}</td>
                    <td className="px-3 py-2 text-purple-400">1/12</td>
                    <td className="px-3 py-2 text-gray-500">nao</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Instruções */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Instruções</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
                  <p className="text-xs font-medium text-indigo-400 mb-1">Coluna: Data</p>
                  <p className="text-[11px] text-gray-400">Formato <code className="text-gray-300">dd/mm/aaaa</code> ou <code className="text-gray-300">aaaa-mm-dd</code></p>
                </div>
                <div className="p-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
                  <p className="text-xs font-medium text-indigo-400 mb-1">Coluna: Descricao</p>
                  <p className="text-[11px] text-gray-400">Descrição/histórico da transação</p>
                </div>
                <div className="p-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
                  <p className="text-xs font-medium text-indigo-400 mb-1">Coluna: Valor</p>
                  <p className="text-[11px] text-gray-400">Use ponto como decimal (ex: <code className="text-gray-300">1500.00</code>). Negativo = despesa automaticamente.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
                  <p className="text-xs font-medium text-indigo-400 mb-1">Coluna: Tipo <span className="text-gray-600">(opcional)</span></p>
                  <p className="text-[11px] text-gray-400"><code className="text-gray-300">receita</code> ou <code className="text-gray-300">despesa</code>. Se omitido, define pelo sinal do valor.</p>
                </div>
                <div className="p-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
                  <p className="text-xs font-medium text-amber-400 mb-1">Coluna: Franquia <span className="text-gray-600">(opcional)</span></p>
                  <p className="text-[11px] text-gray-400">Nome <strong>exato</strong> da empresa/franquia cadastrada. Associa automaticamente cada transação à empresa.</p>
                </div>
                <div className="p-3 rounded-lg bg-[#16161f] border border-purple-500/20">
                  <p className="text-xs font-medium text-purple-400 mb-1">Coluna: Parcela <span className="text-gray-600">(opcional)</span></p>
                  <p className="text-[11px] text-gray-400">Formato <code className="text-gray-300">X/Y</code> (ex: <code className="text-gray-300">2/10</code> = parcela 2 de 10). Ao importar para cartão, gera todas as parcelas restantes com vencimento automático baseado na data de fechamento do cartão.</p>
                </div>
                <div className="p-3 rounded-lg bg-[#16161f] border border-cyan-500/20">
                  <p className="text-xs font-medium text-cyan-400 mb-1">Coluna: Fixo <span className="text-gray-600">(opcional)</span></p>
                  <p className="text-[11px] text-gray-400"><code className="text-gray-300">sim</code> ou <code className="text-gray-300">nao</code>. Marca a transação como despesa fixa mensal (recorrente). Ideal para assinaturas, aluguel, etc.</p>
                </div>
                <div className="p-3 rounded-lg bg-[#16161f] border border-[#2a2a3a]">
                  <p className="text-xs font-medium text-gray-400 mb-1">Separador</p>
                  <p className="text-[11px] text-gray-400">Ponto-e-vírgula (<code className="text-gray-300">;</code>), vírgula (<code className="text-gray-300">,</code>) ou tabulação.</p>
                </div>
              </div>
            </div>

            {/* Franquias cadastradas */}
            {franquias.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <p className="text-xs font-medium text-amber-400 mb-2">Suas empresas/franquias cadastradas (use estes nomes na coluna &ldquo;Franquia&rdquo;):</p>
                <div className="flex flex-wrap gap-2">
                  {franquias.map(f => (
                    <span key={f.id} className="text-xs bg-amber-500/10 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/20 font-mono">
                      {f.nome}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
