'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAppStore, useAuthStore } from '@/store'
import {
  LayoutDashboard,
  Building2,
  ArrowUpDown,
  Receipt,
  Wallet,
  FileBarChart,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Globe,
  TrendingUp,
} from 'lucide-react'

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/franquias', label: 'Franquias', icon: Building2 },
  { href: '/dashboard/transacoes', label: 'Transações', icon: ArrowUpDown },
  { href: '/dashboard/cobrancas', label: 'Cobranças', icon: Receipt },
  { href: '/dashboard/pessoal', label: 'Finanças Pessoais', icon: Wallet },
  { href: '/dashboard/orcamentos', label: 'Orçamentos', icon: TrendingUp },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: FileBarChart },
  { href: '/dashboard/notificacoes', label: 'Notificações', icon: Bell },
  { href: '/dashboard/integracoes', label: 'Integrações', icon: Globe },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar, viewMode, setViewMode } = useAppStore()
  const { user, setUser, logout: logoutStore } = useAuthStore()
  const [showViewDropdown, setShowViewDropdown] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.user) {
        setUser(data.user)
      } else {
        router.push('/login')
      }
    } catch {
      router.push('/login')
    }
  }, [router, setUser])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    logoutStore()
    router.push('/login')
  }

  const viewModeLabels = {
    consolidado: 'Consolidado',
    franquia: 'Por Franquia',
    pessoal: 'Pessoal',
  }

  return (
    <div className="min-h-screen gradient-bg flex">
      {/* Sidebar Desktop */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 sidebar-transition ${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-[#0d0d14]/95 backdrop-blur-xl border-r border-[#2a2a3a] hidden lg:flex flex-col`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#2a2a3a]">
          <img src="https://gpakoffbuypbmfiwewka.supabase.co/storage/v1/object/public/Farol/Loguin%20farolchat.png" alt="Farol Finance" className="flex-shrink-0 w-10 h-10 rounded-xl object-contain" />
          {sidebarOpen && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
                Farol Finance
              </h1>
              <p className="text-[10px] text-gray-600 whitespace-nowrap">v1.0 Pro</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1c1c28] border border-transparent'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'group-hover:text-indigo-400'}`} />
                {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User - Bottom */}
        <div className="border-t border-[#2a2a3a] p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{user?.nome || 'Usuário'}</p>
                <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors" title="Sair">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center text-gray-500 hover:text-red-400 p-2" title="Sair">
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-[#0d0d14] border-r border-[#2a2a3a] flex flex-col">
            <div className="flex items-center justify-between px-5 py-5 border-b border-[#2a2a3a]">
              <div className="flex items-center gap-3">
                <img src="https://gpakoffbuypbmfiwewka.supabase.co/storage/v1/object/public/Farol/Loguin%20farolchat.png" alt="Farol Finance" className="w-10 h-10 rounded-xl object-contain" />
                <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Farol Finance
                </h1>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {menuItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      isActive
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#1c1c28] border border-transparent'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-[#2a2a3a]">
          <div className="flex items-center justify-between px-4 lg:px-6 py-3">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden text-gray-400 hover:text-white">
                <Menu className="w-5 h-5" />
              </button>
              {/* Desktop sidebar toggle */}
              <button onClick={toggleSidebar} className="hidden lg:flex text-gray-400 hover:text-white">
                <Menu className="w-5 h-5" />
              </button>

              {/* View Mode Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowViewDropdown(!showViewDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#16161f] border border-[#2a2a3a] text-sm text-gray-300 hover:border-indigo-500/30 transition-colors"
                >
                  <span className="hidden sm:inline">Visão:</span>
                  <span className="text-indigo-400 font-medium">{viewModeLabels[viewMode]}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showViewDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-[#16161f] border border-[#2a2a3a] rounded-lg shadow-xl py-1 z-50">
                    {(['consolidado', 'franquia', 'pessoal'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => { setViewMode(mode); setShowViewDropdown(false) }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          viewMode === mode ? 'text-indigo-400 bg-indigo-500/10' : 'text-gray-400 hover:bg-[#1c1c28] hover:text-white'
                        }`}
                      >
                        {viewModeLabels[mode]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="relative text-gray-400 hover:text-white transition-colors p-2">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full pulse-dot" />
              </button>
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                  {user?.nome?.charAt(0)?.toUpperCase() || <User className="w-3 h-3" />}
                </div>
                <span className="text-gray-300">{user?.nome?.split(' ')[0]}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
