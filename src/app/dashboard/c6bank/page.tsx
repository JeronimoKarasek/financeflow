'use client'

import { useState, useEffect } from 'react'
import {
  Building2, CheckCircle, XCircle, RefreshCw, Wallet, FileText,
  QrCode, CreditCard, ArrowDownLeft, ArrowUpRight, Download,
  Send, Eye, X, Plus, Calendar, DollarSign, Activity, Loader2,
  Link as LinkIcon, BarChart3, AlertTriangle, Copy, Check
} from 'lucide-react'

interface ContaBancaria {
  id: string; nome: string; banco?: string | null
}

type TabType = 'resumo' | 'pix' | 'boletos' | 'checkout' | 'extrato' | 'dda' | 'c6pay'

export default function C6BankPage() {
  const [activeTab, setActiveTab] = useState<TabType>('resumo')
  const [connection, setConnection] = useState<{ connected: boolean; message: string; ambiente?: string; pix_key?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [contas, setContas] = useState<ContaBancaria[]>([])

  // PIX State
  const [pixCobrancas, setPixCobrancas] = useState<Record<string, unknown>[]>([])
  const [pixLoading, setPixLoading] = useState(false)
  const [showPixModal, setShowPixModal] = useState(false)
  const [pixForm, setPixForm] = useState({ valor: '', cpf: '', nome: '', descricao: '', expiracao: '3600', conta_bancaria_id: '', registrar_transacao: true })
  const [pixSubmitting, setPixSubmitting] = useState(false)
  const [pixResult, setPixResult] = useState<Record<string, unknown> | null>(null)

  // Boleto State
  const [showBoletoModal, setShowBoletoModal] = useState(false)
  const [boletoForm, setBoletoForm] = useState({
    valor: '', vencimento: '', nome: '', cpf_cnpj: '', email: '',
    rua: '', numero: '', complemento: '', cidade: '', estado: '', cep: '',
    registrar_cobranca: true,
  })
  const [boletoSubmitting, setBoletoSubmitting] = useState(false)
  const [boletoResult, setBoletoResult] = useState<Record<string, unknown> | null>(null)

  // Checkout State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState({
    valor: '', descricao: '', nome: '', cpf_cnpj: '', email: '', redirect_url: '', registrar_cobranca: true,
  })
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<Record<string, unknown> | null>(null)

  // Extrato State
  const [extrato, setExtrato] = useState<Record<string, unknown>[]>([])
  const [extratoLoading, setExtratoLoading] = useState(false)
  const [extratoStart, setExtratoStart] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const [extratoEnd, setExtratoEnd] = useState(new Date().toISOString().split('T')[0])
  const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null)

  // DDA State
  const [dda, setDda] = useState<Record<string, unknown>[]>([])
  const [ddaLoading, setDdaLoading] = useState(false)
  const [showDecodeModal, setShowDecodeModal] = useState(false)
  const [decodeForm, setDecodeForm] = useState({ content: '', amount: '', transaction_date: '' })

  // C6 Pay State
  const [c6payData, setC6payData] = useState<Record<string, unknown>[]>([])
  const [c6payLoading, setC6payLoading] = useState(false)

  // Saldo
  const [saldo, setSaldo] = useState<Record<string, unknown> | null>(null)

  // Copied
  const [copied, setCopied] = useState(false)

  // Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => { checkConnection(); fetchContas() }, [])

  const checkConnection = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/c6bank/auth')
      const data = await res.json()
      setConnection(data)
    } catch { setConnection({ connected: false, message: 'Erro de rede' }) }
    setLoading(false)
  }

  const fetchContas = async () => {
    try {
      const res = await fetch('/api/contas')
      const data = await res.json()
      setContas(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 5000)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ---- PIX ----
  const fetchPixCobrancas = async () => {
    setPixLoading(true)
    try {
      const res = await fetch('/api/c6bank/pix')
      const data = await res.json()
      setPixCobrancas(Array.isArray(data.cobs || data) ? (data.cobs || data) : [])
    } catch { setPixCobrancas([]) }
    setPixLoading(false)
  }

  const handlePixSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPixSubmitting(true)
    try {
      const res = await fetch('/api/c6bank/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pixForm),
      })
      const data = await res.json()
      if (!res.ok) { showFeedback('error', data.error || 'Erro ao criar PIX'); setPixSubmitting(false); return }
      setPixResult(data)
      showFeedback('success', 'Cobrança PIX criada com sucesso!')
      setShowPixModal(false)
      fetchPixCobrancas()
    } catch { showFeedback('error', 'Erro de conexão') }
    setPixSubmitting(false)
  }

  // ---- BOLETO ----
  const handleBoletoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBoletoSubmitting(true)
    try {
      const res = await fetch('/api/c6bank/boletos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: boletoForm.valor,
          vencimento: boletoForm.vencimento,
          pagador: {
            nome: boletoForm.nome,
            cpf_cnpj: boletoForm.cpf_cnpj,
            email: boletoForm.email,
            endereco: boletoForm.rua ? {
              rua: boletoForm.rua,
              numero: parseInt(boletoForm.numero) || 0,
              complemento: boletoForm.complemento,
              cidade: boletoForm.cidade,
              estado: boletoForm.estado,
              cep: boletoForm.cep,
            } : undefined,
          },
          registrar_cobranca: boletoForm.registrar_cobranca,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showFeedback('error', data.error || 'Erro ao emitir boleto'); setBoletoSubmitting(false); return }
      setBoletoResult(data)
      showFeedback('success', 'Boleto emitido com sucesso!')
      setShowBoletoModal(false)
    } catch { showFeedback('error', 'Erro de conexão') }
    setBoletoSubmitting(false)
  }

  // ---- CHECKOUT ----
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCheckoutSubmitting(true)
    try {
      const res = await fetch('/api/c6bank/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: checkoutForm.valor,
          descricao: checkoutForm.descricao,
          pagador: { nome: checkoutForm.nome, cpf_cnpj: checkoutForm.cpf_cnpj, email: checkoutForm.email },
          redirect_url: checkoutForm.redirect_url,
          registrar_cobranca: checkoutForm.registrar_cobranca,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showFeedback('error', data.error || 'Erro'); setCheckoutSubmitting(false); return }
      setCheckoutResult(data)
      showFeedback('success', 'Link de pagamento criado!')
      setShowCheckoutModal(false)
    } catch { showFeedback('error', 'Erro de conexão') }
    setCheckoutSubmitting(false)
  }

  // ---- EXTRATO ----
  const fetchExtrato = async () => {
    setExtratoLoading(true)
    try {
      const res = await fetch(`/api/c6bank/extrato?start_date=${extratoStart}&end_date=${extratoEnd}`)
      const data = await res.json()
      setExtrato(Array.isArray(data) ? data : data.data || data.entries || [])
    } catch { setExtrato([]) }
    setExtratoLoading(false)
  }

  const importarExtrato = async () => {
    setExtratoLoading(true)
    try {
      const res = await fetch('/api/c6bank/extrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'importar', start_date: extratoStart, end_date: extratoEnd }),
      })
      const data = await res.json()
      setImportResult(data)
      if (data.success) showFeedback('success', data.message)
      else showFeedback('error', data.error || 'Erro na importação')
    } catch { showFeedback('error', 'Erro de conexão') }
    setExtratoLoading(false)
  }

  // ---- SALDO ----
  const fetchSaldo = async () => {
    try {
      const res = await fetch('/api/c6bank/extrato?tipo=saldo')
      const data = await res.json()
      setSaldo(data)
    } catch { /* ignore */ }
  }

  // ---- DDA ----
  const fetchDDA = async () => {
    setDdaLoading(true)
    try {
      const res = await fetch('/api/c6bank/extrato?tipo=dda')
      const data = await res.json()
      setDda(Array.isArray(data) ? data : data.data || [])
    } catch { setDda([]) }
    setDdaLoading(false)
  }

  const handleDecode = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/c6bank/extrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decodificar',
          items: [{
            content: decodeForm.content,
            amount: parseFloat(decodeForm.amount) || 0,
            transaction_date: decodeForm.transaction_date,
            bank_code: '', bank_name: '', beneficiary_name: '', description: '', payer_name: '',
          }],
        }),
      })
      const data = await res.json()
      if (res.ok) showFeedback('success', `Decodificado: ${JSON.stringify(data).substring(0, 100)}`)
      else showFeedback('error', data.error)
      setShowDecodeModal(false)
    } catch { showFeedback('error', 'Erro') }
  }

  // ---- C6 PAY ----
  const fetchC6Pay = async () => {
    setC6payLoading(true)
    try {
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
      const res = await fetch(`/api/c6bank/checkout?tipo=transacoes&start_date=${startDate}`)
      const data = await res.json()
      setC6payData(Array.isArray(data) ? data : data.data || [])
    } catch { setC6payData([]) }
    setC6payLoading(false)
  }

  useEffect(() => {
    if (!connection?.connected) return
    if (activeTab === 'pix') fetchPixCobrancas()
    if (activeTab === 'extrato') fetchExtrato()
    if (activeTab === 'dda') fetchDDA()
    if (activeTab === 'c6pay') fetchC6Pay()
    if (activeTab === 'resumo') fetchSaldo()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, connection?.connected])

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'resumo', label: 'Resumo', icon: BarChart3 },
    { id: 'pix', label: 'PIX', icon: QrCode },
    { id: 'boletos', label: 'Boletos', icon: FileText },
    { id: 'checkout', label: 'Link Pagamento', icon: LinkIcon },
    { id: 'extrato', label: 'Extrato', icon: ArrowDownLeft },
    { id: 'dda', label: 'DDA', icon: Calendar },
    { id: 'c6pay', label: 'C6 Pay', icon: CreditCard },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#242424] flex items-center justify-center border border-gray-700">
            <span className="text-xl font-bold text-white">C6</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">C6 Bank</h1>
            <p className="text-gray-500 text-sm">PIX · Boletos · Checkout · Extrato · DDA · C6 Pay</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {connection?.connected ? (
            <span className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              Conectado ({connection.ambiente === 'producao' ? 'Produção' : 'Sandbox'})
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm text-red-400">
              <XCircle className="w-4 h-4" />
              Desconectado
            </span>
          )}
          <button onClick={checkConnection} className="p-2 rounded-lg bg-[#1a1a2e] hover:bg-[#252540] border border-[#2a2a3a]">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {feedback.msg}
        </div>
      )}

      {/* Not Connected */}
      {!connection?.connected && (
        <div className="glass-card p-8 text-center">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">C6 Bank não configurado</h2>
          <p className="text-gray-400 text-sm mb-4">{connection?.message}</p>
          {connection?.message?.includes('mTLS') || connection?.message?.includes('mtls') || connection?.message?.includes('403') ? (
            <div className="text-left max-w-md mx-auto space-y-3">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <strong>Erro mTLS:</strong> O C6 Bank exige certificado de cliente (mTLS) em todas as requisições, inclusive sandbox.
              </div>
              <p className="text-gray-400 text-xs">Para resolver:</p>
              <ol className="text-gray-400 text-xs space-y-1 list-decimal list-inside">
                <li>O C6 Bank deve ter enviado arquivos <code className="text-indigo-400">.crt</code> e <code className="text-indigo-400">.key</code></li>
                <li>Abra os arquivos em um editor de texto</li>
                <li>Vá em <strong>Integrações</strong> → C6 Bank</li>
                <li>Cole o conteúdo do <code className="text-indigo-400">.crt</code> no campo &ldquo;Certificado mTLS&rdquo;</li>
                <li>Cole o conteúdo do <code className="text-indigo-400">.key</code> no campo &ldquo;Chave Privada mTLS&rdquo;</li>
                <li>Salve e volte aqui</li>
              </ol>
            </div>
          ) : (
            <p className="text-gray-500 text-xs">
              Vá em <strong>Integrações</strong>, clique no C6 Bank e configure:<br />
              <code className="text-indigo-400">API Key</code> = Client ID &nbsp;|&nbsp;
              <code className="text-indigo-400">API Secret</code> = Client Secret &nbsp;|&nbsp;
              <code className="text-indigo-400">Access Token</code> = Chave PIX<br />
              + Certificados mTLS (.crt e .key)
            </p>
          )}
        </div>
      )}

      {/* Connected Content */}
      {connection?.connected && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1a2e]'
                }`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ============ RESUMO ============ */}
          {activeTab === 'resumo' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Saldo</p>
                      <p className="text-lg font-bold text-white">
                        {saldo ? `R$ ${parseFloat(String(saldo.balance || saldo.available || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                      </p>
                    </div>
                  </div>
                  <button onClick={fetchSaldo} className="text-xs text-indigo-400 hover:text-indigo-300">Atualizar saldo</button>
                </div>

                <div className="glass-card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <QrCode className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Chave PIX</p>
                      <p className="text-sm font-mono text-gray-300 truncate max-w-[200px]">{connection.pix_key || '—'}</p>
                    </div>
                  </div>
                  {connection.pix_key && (
                    <button onClick={() => copyToClipboard(connection.pix_key!)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                      {copied ? <><Check className="w-3 h-3" /> Copiado!</> : <><Copy className="w-3 h-3" /> Copiar chave</>}
                    </button>
                  )}
                </div>

                <div className="glass-card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Ambiente</p>
                      <p className="text-lg font-bold text-white">{connection.ambiente === 'producao' ? 'Produção' : 'Sandbox'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Sandbox: Seg-Sex, 7h-23h</p>
                </div>
              </div>

              <div className="glass-card p-5">
                <h3 className="font-semibold text-white mb-3">Funcionalidades Disponíveis</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: QrCode, label: 'PIX Cobrança', desc: 'Cob imediata e com vencimento', color: 'text-blue-400' },
                    { icon: FileText, label: 'Boletos', desc: 'Emissão, consulta e cancelamento', color: 'text-green-400' },
                    { icon: LinkIcon, label: 'Link Pagamento', desc: 'Checkout com PIX/Cartão', color: 'text-purple-400' },
                    { icon: ArrowDownLeft, label: 'Extrato', desc: 'Movimentações da conta', color: 'text-cyan-400' },
                    { icon: Calendar, label: 'DDA', desc: 'Boletos pendentes (débito direto)', color: 'text-amber-400' },
                    { icon: CreditCard, label: 'C6 Pay', desc: 'Recebíveis de maquininha', color: 'text-pink-400' },
                    { icon: Download, label: 'Importar', desc: 'Extrato direto para o sistema', color: 'text-indigo-400' },
                    { icon: Send, label: 'Webhooks', desc: 'Notificações em tempo real', color: 'text-orange-400' },
                  ].map((f, i) => (
                    <div key={i} className="p-3 rounded-lg bg-[#0d0d14] border border-[#2a2a3a]">
                      <f.icon className={`w-5 h-5 ${f.color} mb-2`} />
                      <p className="text-sm font-medium text-white">{f.label}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ PIX ============ */}
          {activeTab === 'pix' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Cobranças PIX</h2>
                <div className="flex gap-2">
                  <button onClick={fetchPixCobrancas} className="btn-secondary text-xs flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Atualizar
                  </button>
                  <button onClick={() => setShowPixModal(true)} className="btn-primary text-xs flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Nova Cobrança PIX
                  </button>
                </div>
              </div>

              {/* PIX Result */}
              {pixResult && (
                <div className="glass-card p-4 border-emerald-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-emerald-400">PIX Criado com Sucesso</h3>
                    <button onClick={() => setPixResult(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-1 text-xs text-gray-300">
                    {pixResult.txid && <p>TxID: <code className="text-indigo-400">{String(pixResult.txid)}</code></p>}
                    {pixResult.location && <p>Location: <code className="text-indigo-400">{String(pixResult.location)}</code></p>}
                    {pixResult.pixCopiaECola && (
                      <div className="mt-2">
                        <p className="text-gray-500 mb-1">PIX Copia e Cola:</p>
                        <div className="flex gap-2">
                          <code className="flex-1 p-2 rounded bg-[#0d0d14] text-[10px] break-all">{String(pixResult.pixCopiaECola)}</code>
                          <button onClick={() => copyToClipboard(String(pixResult.pixCopiaECola))} className="btn-primary text-xs px-3">
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PIX List */}
              {pixLoading ? (
                <div className="glass-card p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto" /></div>
              ) : pixCobrancas.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <QrCode className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Nenhuma cobrança PIX encontrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pixCobrancas.map((cob, i) => (
                    <div key={i} className="glass-card p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <QrCode className="w-8 h-8 text-blue-400" />
                        <div>
                          <p className="text-sm font-medium text-white">{String(cob.txid || cob.solicitacaoPagador || 'PIX')}</p>
                          <p className="text-xs text-gray-500">{String(cob.status || '')} · {String(cob.calendario?.criacao || '')}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-emerald-400">R$ {parseFloat(String(cob.valor?.original || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============ BOLETOS ============ */}
          {activeTab === 'boletos' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Boletos C6 Bank</h2>
                <button onClick={() => setShowBoletoModal(true)} className="btn-primary text-xs flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Emitir Boleto
                </button>
              </div>

              {boletoResult && (
                <div className="glass-card p-4 border-emerald-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-emerald-400">Boleto Emitido</h3>
                    <button onClick={() => setBoletoResult(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-1 text-xs text-gray-300">
                    {boletoResult.id && <p>ID: <code className="text-indigo-400">{String(boletoResult.id)}</code></p>}
                    {boletoResult.digitable_line && (
                      <div className="mt-2">
                        <p className="text-gray-500 mb-1">Linha Digitável:</p>
                        <div className="flex gap-2">
                          <code className="flex-1 p-2 rounded bg-[#0d0d14] text-[10px] break-all">{String(boletoResult.digitable_line)}</code>
                          <button onClick={() => copyToClipboard(String(boletoResult.digitable_line))} className="btn-primary text-xs px-3">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    {boletoResult.bar_code && <p>Código de Barras: <code className="text-indigo-400 text-[10px]">{String(boletoResult.bar_code)}</code></p>}
                  </div>
                </div>
              )}

              <div className="glass-card p-8 text-center">
                <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Emita boletos e consulte pelo ID</p>
                <p className="text-gray-600 text-xs mt-1">Até 2.000 boletos gratuitos nos 4 primeiros meses • Recebimento D+0</p>
              </div>
            </div>
          )}

          {/* ============ CHECKOUT / LINK DE PAGAMENTO ============ */}
          {activeTab === 'checkout' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Links de Pagamento (Checkout)</h2>
                <button onClick={() => setShowCheckoutModal(true)} className="btn-primary text-xs flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Criar Link
                </button>
              </div>

              {checkoutResult && (
                <div className="glass-card p-4 border-emerald-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-emerald-400">Link Criado</h3>
                    <button onClick={() => setCheckoutResult(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-1 text-xs text-gray-300">
                    {(checkoutResult.checkout_url || checkoutResult.url) && (
                      <div className="mt-1">
                        <p className="text-gray-500 mb-1">Link:</p>
                        <div className="flex gap-2">
                          <code className="flex-1 p-2 rounded bg-[#0d0d14] text-[10px] break-all text-indigo-400">{String(checkoutResult.checkout_url || checkoutResult.url)}</code>
                          <button onClick={() => copyToClipboard(String(checkoutResult.checkout_url || checkoutResult.url))} className="btn-primary text-xs px-3">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="glass-card p-8 text-center">
                <LinkIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Crie links de pagamento via C6 Pay</p>
                <p className="text-gray-600 text-xs mt-1">Aceita PIX e cartão de crédito/débito</p>
              </div>
            </div>
          )}

          {/* ============ EXTRATO ============ */}
          {activeTab === 'extrato' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Extrato Bancário</h2>
                <div className="flex items-center gap-2">
                  <input type="date" value={extratoStart} onChange={e => setExtratoStart(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a2e] border border-[#2a2a3a] text-white" />
                  <span className="text-gray-500 text-xs">até</span>
                  <input type="date" value={extratoEnd} onChange={e => setExtratoEnd(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a2e] border border-[#2a2a3a] text-white" />
                  <button onClick={fetchExtrato} className="btn-secondary text-xs flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Consultar
                  </button>
                  <button onClick={importarExtrato} className="btn-primary text-xs flex items-center gap-1">
                    <Download className="w-3 h-3" /> Importar
                  </button>
                </div>
              </div>

              {importResult && (
                <div className="glass-card p-3 border-emerald-500/20 text-sm text-emerald-400">
                  Importados: {String(importResult.imported)} | Ignorados: {String(importResult.skipped)} | Total: {String(importResult.total)}
                </div>
              )}

              {extratoLoading ? (
                <div className="glass-card p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto" /></div>
              ) : extrato.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <ArrowDownLeft className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Nenhuma movimentação encontrada</p>
                  <p className="text-gray-600 text-xs mt-1">Selecione um período e clique em Consultar</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {extrato.map((e, i) => {
                    const valor = parseFloat(String(e.amount || e.valor || 0))
                    const isPositive = valor >= 0
                    return (
                      <div key={i} className="glass-card p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isPositive ? <ArrowDownLeft className="w-5 h-5 text-emerald-400" /> : <ArrowUpRight className="w-5 h-5 text-red-400" />}
                          <div>
                            <p className="text-sm text-white">{String(e.description || e.descricao || 'Movimentação')}</p>
                            <p className="text-[10px] text-gray-500">{String(e.date || e.data || '')}</p>
                          </div>
                        </div>
                        <p className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}R$ {Math.abs(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============ DDA ============ */}
          {activeTab === 'dda' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">DDA - Débito Direto Autorizado</h2>
                <div className="flex gap-2">
                  <button onClick={fetchDDA} className="btn-secondary text-xs flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Atualizar
                  </button>
                  <button onClick={() => setShowDecodeModal(true)} className="btn-primary text-xs flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Decodificar Boleto
                  </button>
                </div>
              </div>

              {ddaLoading ? (
                <div className="glass-card p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto" /></div>
              ) : dda.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Nenhum boleto DDA pendente</p>
                  <p className="text-gray-600 text-xs mt-1">Consulte boletos pendentes ou decodifique códigos de barras</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dda.map((d, i) => (
                    <div key={i} className="glass-card p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white">{String(d.beneficiary_name || d.description || 'Boleto')}</p>
                        <p className="text-xs text-gray-500">{String(d.due_date || d.transaction_date || '')}</p>
                      </div>
                      <p className="text-sm font-bold text-amber-400">R$ {parseFloat(String(d.amount || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============ C6 PAY ============ */}
          {activeTab === 'c6pay' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-white">C6 Pay - Adquirência</h2>
                  <p className="text-xs text-gray-500">Vendas por maquininha e links de pagamento</p>
                </div>
                <button onClick={fetchC6Pay} className="btn-secondary text-xs flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Atualizar
                </button>
              </div>

              {c6payLoading ? (
                <div className="glass-card p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto" /></div>
              ) : c6payData.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <CreditCard className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Nenhuma transação C6 Pay encontrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {c6payData.map((t, i) => (
                    <div key={i} className="glass-card p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white">{String(t.description || t.type || 'Transação')}</p>
                        <p className="text-xs text-gray-500">{String(t.date || t.created_at || '')}</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-400">R$ {parseFloat(String(t.amount || t.net_amount || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* =============== MODAIS =============== */}

      {/* Modal PIX */}
      {showPixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPixModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Nova Cobrança PIX</h2>
              <button onClick={() => setShowPixModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handlePixSubmit} className="space-y-4">
              <div><label className="block text-xs text-gray-400 mb-1">Valor (R$) *</label>
                <input type="text" value={pixForm.valor} onChange={e => setPixForm({...pixForm, valor: e.target.value})} className="w-full px-3 py-2 text-sm" placeholder="150.00" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">CPF do Pagador</label>
                  <input type="text" value={pixForm.cpf} onChange={e => setPixForm({...pixForm, cpf: e.target.value})} className="w-full px-3 py-2 text-sm" placeholder="12345678900" />
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Nome do Pagador</label>
                  <input type="text" value={pixForm.nome} onChange={e => setPixForm({...pixForm, nome: e.target.value})} className="w-full px-3 py-2 text-sm" />
                </div>
              </div>
              <div><label className="block text-xs text-gray-400 mb-1">Descrição</label>
                <input type="text" value={pixForm.descricao} onChange={e => setPixForm({...pixForm, descricao: e.target.value})} className="w-full px-3 py-2 text-sm" placeholder="Pagamento de serviço" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Expiração (seg)</label>
                  <input type="number" value={pixForm.expiracao} onChange={e => setPixForm({...pixForm, expiracao: e.target.value})} className="w-full px-3 py-2 text-sm" />
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Conta Bancária</label>
                  <select value={pixForm.conta_bancaria_id} onChange={e => setPixForm({...pixForm, conta_bancaria_id: e.target.value})} className="w-full px-3 py-2 text-sm">
                    <option value="">Nenhuma</option>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={pixForm.registrar_transacao} onChange={e => setPixForm({...pixForm, registrar_transacao: e.target.checked})} className="rounded" />
                Registrar como transação no sistema
              </label>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPixModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" disabled={pixSubmitting} className="btn-primary flex-1 text-sm disabled:opacity-50">
                  {pixSubmitting ? 'Criando...' : 'Criar Cobrança PIX'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Boleto */}
      {showBoletoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBoletoModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Emitir Boleto C6</h2>
              <button onClick={() => setShowBoletoModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleBoletoSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Valor (R$) *</label>
                  <input type="text" value={boletoForm.valor} onChange={e => setBoletoForm({...boletoForm, valor: e.target.value})} className="w-full px-3 py-2 text-sm" required />
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Vencimento *</label>
                  <input type="date" value={boletoForm.vencimento} onChange={e => setBoletoForm({...boletoForm, vencimento: e.target.value})} className="w-full px-3 py-2 text-sm" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Nome do Pagador *</label>
                  <input type="text" value={boletoForm.nome} onChange={e => setBoletoForm({...boletoForm, nome: e.target.value})} className="w-full px-3 py-2 text-sm" required />
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">CPF/CNPJ *</label>
                  <input type="text" value={boletoForm.cpf_cnpj} onChange={e => setBoletoForm({...boletoForm, cpf_cnpj: e.target.value})} className="w-full px-3 py-2 text-sm" required />
                </div>
              </div>
              <div><label className="block text-xs text-gray-400 mb-1">Email</label>
                <input type="email" value={boletoForm.email} onChange={e => setBoletoForm({...boletoForm, email: e.target.value})} className="w-full px-3 py-2 text-sm" />
              </div>
              <div className="border-t border-[#2a2a3a] pt-3">
                <p className="text-xs text-gray-500 mb-3">Endereço (opcional)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><input type="text" value={boletoForm.rua} onChange={e => setBoletoForm({...boletoForm, rua: e.target.value})} className="w-full px-3 py-2 text-xs" placeholder="Rua" /></div>
                  <div><input type="text" value={boletoForm.numero} onChange={e => setBoletoForm({...boletoForm, numero: e.target.value})} className="w-full px-3 py-2 text-xs" placeholder="Nº" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div><input type="text" value={boletoForm.cidade} onChange={e => setBoletoForm({...boletoForm, cidade: e.target.value})} className="w-full px-3 py-2 text-xs" placeholder="Cidade" /></div>
                  <div><input type="text" value={boletoForm.estado} onChange={e => setBoletoForm({...boletoForm, estado: e.target.value})} className="w-full px-3 py-2 text-xs" placeholder="UF" maxLength={2} /></div>
                  <div><input type="text" value={boletoForm.cep} onChange={e => setBoletoForm({...boletoForm, cep: e.target.value})} className="w-full px-3 py-2 text-xs" placeholder="CEP" /></div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={boletoForm.registrar_cobranca} onChange={e => setBoletoForm({...boletoForm, registrar_cobranca: e.target.checked})} className="rounded" />
                Registrar como cobrança no sistema
              </label>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowBoletoModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" disabled={boletoSubmitting} className="btn-primary flex-1 text-sm disabled:opacity-50">
                  {boletoSubmitting ? 'Emitindo...' : 'Emitir Boleto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Checkout */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCheckoutModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Criar Link de Pagamento</h2>
              <button onClick={() => setShowCheckoutModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Valor (R$) *</label>
                  <input type="text" value={checkoutForm.valor} onChange={e => setCheckoutForm({...checkoutForm, valor: e.target.value})} className="w-full px-3 py-2 text-sm" required />
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Descrição *</label>
                  <input type="text" value={checkoutForm.descricao} onChange={e => setCheckoutForm({...checkoutForm, descricao: e.target.value})} className="w-full px-3 py-2 text-sm" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Nome *</label>
                  <input type="text" value={checkoutForm.nome} onChange={e => setCheckoutForm({...checkoutForm, nome: e.target.value})} className="w-full px-3 py-2 text-sm" required />
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">CPF/CNPJ *</label>
                  <input type="text" value={checkoutForm.cpf_cnpj} onChange={e => setCheckoutForm({...checkoutForm, cpf_cnpj: e.target.value})} className="w-full px-3 py-2 text-sm" required />
                </div>
              </div>
              <div><label className="block text-xs text-gray-400 mb-1">Email *</label>
                <input type="email" value={checkoutForm.email} onChange={e => setCheckoutForm({...checkoutForm, email: e.target.value})} className="w-full px-3 py-2 text-sm" required />
              </div>
              <div><label className="block text-xs text-gray-400 mb-1">URL de Redirecionamento</label>
                <input type="url" value={checkoutForm.redirect_url} onChange={e => setCheckoutForm({...checkoutForm, redirect_url: e.target.value})} className="w-full px-3 py-2 text-sm" placeholder="https://seusite.com/sucesso" />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={checkoutForm.registrar_cobranca} onChange={e => setCheckoutForm({...checkoutForm, registrar_cobranca: e.target.checked})} className="rounded" />
                Registrar como cobrança no sistema
              </label>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCheckoutModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" disabled={checkoutSubmitting} className="btn-primary flex-1 text-sm disabled:opacity-50">
                  {checkoutSubmitting ? 'Criando...' : 'Criar Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Decodificar Boleto (DDA) */}
      {showDecodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDecodeModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Decodificar Código de Barras</h2>
              <button onClick={() => setShowDecodeModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleDecode} className="space-y-4">
              <div><label className="block text-xs text-gray-400 mb-1">Linha Digitável / Código de Barras *</label>
                <input type="text" value={decodeForm.content} onChange={e => setDecodeForm({...decodeForm, content: e.target.value})} className="w-full px-3 py-2 text-sm font-mono" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-400 mb-1">Valor (R$)</label>
                  <input type="text" value={decodeForm.amount} onChange={e => setDecodeForm({...decodeForm, amount: e.target.value})} className="w-full px-3 py-2 text-sm" />
                </div>
                <div><label className="block text-xs text-gray-400 mb-1">Data Pagamento</label>
                  <input type="date" value={decodeForm.transaction_date} onChange={e => setDecodeForm({...decodeForm, transaction_date: e.target.value})} className="w-full px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowDecodeModal(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm">Decodificar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
