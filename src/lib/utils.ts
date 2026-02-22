import { clsx, type ClassValue } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export function formatDateFull(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(date))
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pago: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    pendente: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    atrasado: 'text-red-400 bg-red-400/10 border-red-400/20',
    cancelado: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
    agendado: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    parcial: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  }
  return colors[status] || colors.pendente
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pago: 'Pago',
    pendente: 'Pendente',
    atrasado: 'Atrasado',
    cancelado: 'Cancelado',
    agendado: 'Agendado',
    parcial: 'Parcial',
    receber: 'A Receber',
    pagar: 'A Pagar',
  }
  return labels[status] || status
}

export function diasParaVencer(dataVencimento: string): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const vencimento = new Date(dataVencimento)
  vencimento.setHours(0, 0, 0, 0)
  return Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export function percentual(valor: number, total: number): number {
  if (total === 0) return 0
  return Math.round((valor / total) * 100)
}
