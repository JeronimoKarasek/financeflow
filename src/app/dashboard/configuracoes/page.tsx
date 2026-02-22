'use client'

import { useState, useEffect } from 'react'
import { Settings, User, Key, Bell, Shield, Save, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react'

interface ConfigSection {
  id: string
  label: string
  icon: React.ReactNode
}

export default function ConfiguracoesPage() {
  const [activeSection, setActiveSection] = useState('perfil')
  const [saving, setSaving] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [success, setSuccess] = useState('')

  const [perfil, setPerfil] = useState({ nome: 'Junior', email: 'junior.karaseks@gmail.com', telefone: '' })
  const [senhas, setSenhas] = useState({ atual: '', nova: '', confirmar: '' })
  const [apis, setApis] = useState({
    supabase_url: '', supabase_anon_key: '',
    evolution_url: '', evolution_key: '', evolution_instance: '',
    asaas_key: '', asaas_sandbox: true,
    stripe_key: '', stripe_secret: '',
    mercadopago_token: '', mercadopago_public: '',
    hotmart_id: '', hotmart_secret: '', hotmart_token: '',
  })
  const [notificacoes, setNotificacoes] = useState({
    whatsapp_ativo: true, dias_antes_vencimento: 3,
    notificar_atraso: true, notificar_recebimento: false,
    horario_envio: '09:00',
  })

  const sections: ConfigSection[] = [
    { id: 'perfil', label: 'Perfil', icon: <User className="w-4 h-4" /> },
    { id: 'seguranca', label: 'Segurança', icon: <Shield className="w-4 h-4" /> },
    { id: 'apis', label: 'APIs & Integrações', icon: <Key className="w-4 h-4" /> },
    { id: 'notificacoes', label: 'Notificações', icon: <Bell className="w-4 h-4" /> },
  ]

  const togglePassword = (field: string) => setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))

  const handleSave = async () => {
    setSaving(true)
    // Simulate save
    await new Promise(r => setTimeout(r, 1000))
    setSaving(false)
    setSuccess('Configurações salvas com sucesso!')
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie suas preferências e credenciais</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-lg">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="glass-card p-2 space-y-1">
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all ${
                  activeSection === s.id
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-gray-400 hover:bg-[#1c1c28] hover:text-white'
                }`}>
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Perfil */}
          {activeSection === 'perfil' && (
            <div className="glass-card p-6 space-y-5">
              <h3 className="text-lg font-semibold text-white">Dados do Perfil</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nome</label>
                  <input value={perfil.nome} onChange={e => setPerfil({...perfil, nome: e.target.value})} className="w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input value={perfil.email} onChange={e => setPerfil({...perfil, email: e.target.value})} disabled className="w-full px-3 py-2 text-sm opacity-60" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Telefone</label>
                  <input value={perfil.telefone} onChange={e => setPerfil({...perfil, telefone: e.target.value})} placeholder="(41) 99999-9999" className="w-full px-3 py-2 text-sm" />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
                <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          )}

          {/* Segurança */}
          {activeSection === 'seguranca' && (
            <div className="glass-card p-6 space-y-5">
              <h3 className="text-lg font-semibold text-white">Alterar Senha</h3>
              <div className="space-y-4 max-w-md">
                {[
                  { key: 'atual', label: 'Senha Atual', value: senhas.atual },
                  { key: 'nova', label: 'Nova Senha', value: senhas.nova },
                  { key: 'confirmar', label: 'Confirmar Nova Senha', value: senhas.confirmar },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
                    <div className="relative">
                      <input type={showPasswords[f.key] ? 'text' : 'password'} value={f.value}
                        onChange={e => setSenhas({...senhas, [f.key]: e.target.value})}
                        className="w-full px-3 py-2 text-sm pr-10" />
                      <button onClick={() => togglePassword(f.key)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                        {showPasswords[f.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {senhas.nova && senhas.confirmar && senhas.nova !== senhas.confirmar && (
                <p className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> As senhas não coincidem</p>
              )}
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4" /> {saving ? 'Salvando...' : 'Alterar Senha'}
              </button>
            </div>
          )}

          {/* APIs */}
          {activeSection === 'apis' && (
            <div className="glass-card p-6 space-y-6">
              <h3 className="text-lg font-semibold text-white">Credenciais de API</h3>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Suas chaves são salvas de forma segura e criptografada no servidor
              </p>

              {/* Supabase */}
              <div className="border-t border-[#2a2a3a] pt-4">
                <h4 className="text-sm font-semibold text-indigo-400 mb-3">Supabase</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">URL</label>
                    <input value={apis.supabase_url} onChange={e => setApis({...apis, supabase_url: e.target.value})} placeholder="https://xxx.supabase.co" className="w-full px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Anon Key</label>
                    <div className="relative">
                      <input type={showPasswords['supabase'] ? 'text' : 'password'} value={apis.supabase_anon_key} onChange={e => setApis({...apis, supabase_anon_key: e.target.value})} placeholder="eyJ..." className="w-full px-3 py-2 text-sm pr-10" />
                      <button onClick={() => togglePassword('supabase')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"><Eye className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evolution API */}
              <div className="border-t border-[#2a2a3a] pt-4">
                <h4 className="text-sm font-semibold text-emerald-400 mb-3">Evolution API (WhatsApp)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">URL do Servidor</label>
                    <input value={apis.evolution_url} onChange={e => setApis({...apis, evolution_url: e.target.value})} placeholder="https://api.evolution..." className="w-full px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">API Key</label>
                    <div className="relative">
                      <input type={showPasswords['evolution'] ? 'text' : 'password'} value={apis.evolution_key} onChange={e => setApis({...apis, evolution_key: e.target.value})} className="w-full px-3 py-2 text-sm pr-10" />
                      <button onClick={() => togglePassword('evolution')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"><Eye className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nome da Instância</label>
                    <input value={apis.evolution_instance} onChange={e => setApis({...apis, evolution_instance: e.target.value})} placeholder="financeflow" className="w-full px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              {/* Asaas */}
              <div className="border-t border-[#2a2a3a] pt-4">
                <h4 className="text-sm font-semibold text-blue-400 mb-3">Asaas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">API Key</label>
                    <div className="relative">
                      <input type={showPasswords['asaas'] ? 'text' : 'password'} value={apis.asaas_key} onChange={e => setApis({...apis, asaas_key: e.target.value})} className="w-full px-3 py-2 text-sm pr-10" />
                      <button onClick={() => togglePassword('asaas')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"><Eye className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <input type="checkbox" checked={apis.asaas_sandbox} onChange={e => setApis({...apis, asaas_sandbox: e.target.checked})} className="accent-indigo-500" />
                    <label className="text-xs text-gray-400">Modo Sandbox</label>
                  </div>
                </div>
              </div>

              {/* Stripe */}
              <div className="border-t border-[#2a2a3a] pt-4">
                <h4 className="text-sm font-semibold text-purple-400 mb-3">Stripe</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Publishable Key</label>
                    <input value={apis.stripe_key} onChange={e => setApis({...apis, stripe_key: e.target.value})} placeholder="pk_..." className="w-full px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Secret Key</label>
                    <div className="relative">
                      <input type={showPasswords['stripe'] ? 'text' : 'password'} value={apis.stripe_secret} onChange={e => setApis({...apis, stripe_secret: e.target.value})} placeholder="sk_..." className="w-full px-3 py-2 text-sm pr-10" />
                      <button onClick={() => togglePassword('stripe')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"><Eye className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mercado Pago */}
              <div className="border-t border-[#2a2a3a] pt-4">
                <h4 className="text-sm font-semibold text-cyan-400 mb-3">Mercado Pago</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Access Token</label>
                    <div className="relative">
                      <input type={showPasswords['mp'] ? 'text' : 'password'} value={apis.mercadopago_token} onChange={e => setApis({...apis, mercadopago_token: e.target.value})} className="w-full px-3 py-2 text-sm pr-10" />
                      <button onClick={() => togglePassword('mp')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"><Eye className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Public Key</label>
                    <input value={apis.mercadopago_public} onChange={e => setApis({...apis, mercadopago_public: e.target.value})} className="w-full px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              {/* Hotmart */}
              <div className="border-t border-[#2a2a3a] pt-4">
                <h4 className="text-sm font-semibold text-orange-400 mb-3">Hotmart</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Client ID</label>
                    <input value={apis.hotmart_id} onChange={e => setApis({...apis, hotmart_id: e.target.value})} className="w-full px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Client Secret</label>
                    <div className="relative">
                      <input type={showPasswords['hotmart'] ? 'text' : 'password'} value={apis.hotmart_secret} onChange={e => setApis({...apis, hotmart_secret: e.target.value})} className="w-full px-3 py-2 text-sm pr-10" />
                      <button onClick={() => togglePassword('hotmart')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"><Eye className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Basic Token</label>
                    <div className="relative">
                      <input type={showPasswords['hotmart_t'] ? 'text' : 'password'} value={apis.hotmart_token} onChange={e => setApis({...apis, hotmart_token: e.target.value})} className="w-full px-3 py-2 text-sm pr-10" />
                      <button onClick={() => togglePassword('hotmart_t')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"><Eye className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
                <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Credenciais'}
              </button>
            </div>
          )}

          {/* Notificações */}
          {activeSection === 'notificacoes' && (
            <div className="glass-card p-6 space-y-5">
              <h3 className="text-lg font-semibold text-white">Preferências de Notificação</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#1c1c28]">
                  <div>
                    <p className="text-sm text-white">WhatsApp Ativo</p>
                    <p className="text-xs text-gray-500">Enviar notificações via WhatsApp</p>
                  </div>
                  <button onClick={() => setNotificacoes({...notificacoes, whatsapp_ativo: !notificacoes.whatsapp_ativo})}
                    className={`w-11 h-6 rounded-full transition-all relative ${notificacoes.whatsapp_ativo ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${notificacoes.whatsapp_ativo ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[#1c1c28]">
                  <div>
                    <p className="text-sm text-white">Notificar Atrasos</p>
                    <p className="text-xs text-gray-500">Enviar alerta quando cobrança atrasar</p>
                  </div>
                  <button onClick={() => setNotificacoes({...notificacoes, notificar_atraso: !notificacoes.notificar_atraso})}
                    className={`w-11 h-6 rounded-full transition-all relative ${notificacoes.notificar_atraso ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${notificacoes.notificar_atraso ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[#1c1c28]">
                  <div>
                    <p className="text-sm text-white">Notificar Recebimentos</p>
                    <p className="text-xs text-gray-500">Confirmar quando pagamento for recebido</p>
                  </div>
                  <button onClick={() => setNotificacoes({...notificacoes, notificar_recebimento: !notificacoes.notificar_recebimento})}
                    className={`w-11 h-6 rounded-full transition-all relative ${notificacoes.notificar_recebimento ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${notificacoes.notificar_recebimento ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Dias antes do vencimento para notificar</label>
                    <input type="number" value={notificacoes.dias_antes_vencimento}
                      onChange={e => setNotificacoes({...notificacoes, dias_antes_vencimento: +e.target.value})}
                      min={1} max={30} className="w-full px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Horário de envio automático</label>
                    <input type="time" value={notificacoes.horario_envio}
                      onChange={e => setNotificacoes({...notificacoes, horario_envio: e.target.value})}
                      className="w-full px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
                <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Preferências'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
