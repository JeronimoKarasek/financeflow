import { create } from 'zustand'

interface AuthState {
  user: {
    id: string
    email: string
    nome: string
    role: string
    avatar_url?: string | null
  } | null
  isAuthenticated: boolean
  setUser: (user: AuthState['user']) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ user: null, isAuthenticated: false }),
}))

interface AppState {
  sidebarOpen: boolean
  currentFranquiaId: string | null
  viewMode: 'franquia' | 'pessoal' | 'consolidado'
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setCurrentFranquia: (id: string | null) => void
  setViewMode: (mode: 'franquia' | 'pessoal' | 'consolidado') => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  currentFranquiaId: null,
  viewMode: 'consolidado',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCurrentFranquia: (id) => set({ currentFranquiaId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
}))
