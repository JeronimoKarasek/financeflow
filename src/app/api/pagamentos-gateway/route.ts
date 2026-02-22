import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { jwtVerify } from 'jose'

export const dynamic = 'force-dynamic'

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)

async function getUserFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(/ff-token=([^;]+)/)
  if (!match) return null
  try {
    const { payload } = await jwtVerify(match[1], SECRET!)
    return payload as { id: string }
  } catch { return null }
}

async function getCredenciais(userId: string, provedor: string) {
  const supabase = createServerSupabase()
  const { data } = await supabase
    .from('_financeiro_integracoes')
    .select('credenciais, api_key, api_secret, access_token, ambiente, ativa')
    .eq('usuario_id', userId)
    .eq('provedor', provedor)
    .eq('ativa', true)
    .single()
  return data
}

// Buscar pagamentos do Asaas
async function fetchAsaas(userId: string) {
  const creds = await getCredenciais(userId, 'asaas')
  if (!creds) return { error: 'Asaas não configurado', data: [] }

  const apiKey = creds.credenciais?.api_key || creds.api_key
  if (!apiKey) return { error: 'API Key do Asaas não encontrada', data: [] }

  const sandbox = creds.credenciais?.sandbox === 'true' || creds.ambiente === 'sandbox'
  const baseUrl = sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3'

  try {
    const res = await fetch(`${baseUrl}/payments?limit=50&offset=0`, {
      headers: { 'access_token': apiKey },
    })

    if (!res.ok) {
      const errBody = await res.text()
      return { error: `Asaas retornou ${res.status}: ${errBody.substring(0, 200)}`, data: [] }
    }

    const result = await res.json()
    const payments = (result.data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      valor: p.value,
      status: p.status,
      descricao: p.description || 'Sem descrição',
      cliente: p.customer,
      data_criacao: p.dateCreated,
      data_vencimento: p.dueDate,
      data_pagamento: p.paymentDate,
      tipo_cobranca: p.billingType,
      link: p.invoiceUrl,
      gateway: 'asaas',
    }))

    return { data: payments, total: result.totalCount || payments.length }
  } catch (err) {
    return { error: `Erro ao conectar no Asaas: ${(err as Error).message}`, data: [] }
  }
}

// Buscar pagamentos do Stripe
async function fetchStripe(userId: string) {
  const creds = await getCredenciais(userId, 'stripe')
  if (!creds) return { error: 'Stripe não configurado', data: [] }

  const secretKey = creds.credenciais?.secret_key || creds.api_secret
  if (!secretKey) return { error: 'Secret Key do Stripe não encontrada', data: [] }

  try {
    const res = await fetch('https://api.stripe.com/v1/payment_intents?limit=50', {
      headers: { 'Authorization': `Bearer ${secretKey}` },
    })

    if (!res.ok) {
      const errBody = await res.text()
      return { error: `Stripe retornou ${res.status}: ${errBody.substring(0, 200)}`, data: [] }
    }

    const result = await res.json()
    const payments = (result.data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      valor: Number(p.amount) / 100,
      status: p.status,
      descricao: (p as Record<string, unknown>).description || `Payment ${(p.id as string).substring(0, 12)}`,
      cliente: p.customer || '-',
      data_criacao: new Date(Number(p.created) * 1000).toISOString().split('T')[0],
      data_vencimento: null,
      data_pagamento: p.status === 'succeeded' ? new Date(Number(p.created) * 1000).toISOString().split('T')[0] : null,
      tipo_cobranca: (p as Record<string, unknown>).payment_method_types,
      link: null,
      gateway: 'stripe',
      moeda: p.currency,
    }))

    return { data: payments, total: payments.length }
  } catch (err) {
    return { error: `Erro ao conectar no Stripe: ${(err as Error).message}`, data: [] }
  }
}

// Buscar pagamentos do Mercado Pago
async function fetchMercadoPago(userId: string) {
  const creds = await getCredenciais(userId, 'mercadopago')
  if (!creds) return { error: 'Mercado Pago não configurado', data: [] }

  const accessToken = creds.credenciais?.access_token || creds.access_token
  if (!accessToken) return { error: 'Access Token do Mercado Pago não encontrado', data: [] }

  try {
    const res = await fetch('https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=50', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const errBody = await res.text()
      return { error: `Mercado Pago retornou ${res.status}: ${errBody.substring(0, 200)}`, data: [] }
    }

    const result = await res.json()
    const payments = (result.results || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      valor: p.transaction_amount,
      status: p.status,
      descricao: (p as Record<string, unknown>).description || `Pagamento #${p.id}`,
      cliente: (p as Record<string, unknown>).payer ? ((p as Record<string, Record<string, unknown>>).payer?.email || '-') : '-',
      data_criacao: p.date_created ? String(p.date_created).split('T')[0] : null,
      data_vencimento: (p as Record<string, unknown>).date_of_expiration ? String((p as Record<string, unknown>).date_of_expiration).split('T')[0] : null,
      data_pagamento: (p as Record<string, unknown>).date_approved ? String((p as Record<string, unknown>).date_approved).split('T')[0] : null,
      tipo_cobranca: (p as Record<string, unknown>).payment_type_id,
      link: null,
      gateway: 'mercadopago',
      moeda: p.currency_id,
    }))

    return { data: payments, total: result.paging?.total || payments.length }
  } catch (err) {
    return { error: `Erro ao conectar no Mercado Pago: ${(err as Error).message}`, data: [] }
  }
}

// Buscar pagamentos do Hotmart
async function fetchHotmart(userId: string) {
  const creds = await getCredenciais(userId, 'hotmart')
  if (!creds) return { error: 'Hotmart não configurado', data: [] }

  const clientId = creds.credenciais?.client_id
  const clientSecret = creds.credenciais?.client_secret
  const basicToken = creds.credenciais?.basic_token
  if (!clientId && !basicToken) return { error: 'Credenciais do Hotmart incompletas', data: [] }

  try {
    // Autenticar no Hotmart
    let token = basicToken
    if (!token && clientId && clientSecret) {
      const authRes = await fetch('https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      })
      if (authRes.ok) {
        const authData = await authRes.json()
        token = authData.access_token
      }
    }

    if (!token) return { error: 'Não foi possível autenticar no Hotmart', data: [] }

    const res = await fetch('https://developers.hotmart.com/payments/api/v1/sales/history?max_results=50', {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (!res.ok) {
      const errBody = await res.text()
      return { error: `Hotmart retornou ${res.status}: ${errBody.substring(0, 200)}`, data: [] }
    }

    const result = await res.json()
    const payments = (result.items || []).map((p: Record<string, Record<string, unknown>>) => ({
      id: p.purchase?.transaction || p.purchase?.order_date,
      valor: p.purchase?.price?.value || 0,
      status: p.purchase?.status,
      descricao: p.product?.name || 'Produto Hotmart',
      cliente: p.buyer?.name || p.buyer?.email || '-',
      data_criacao: p.purchase?.order_date ? new Date(Number(p.purchase.order_date)).toISOString().split('T')[0] : null,
      data_vencimento: null,
      data_pagamento: p.purchase?.approved_date ? new Date(Number(p.purchase.approved_date)).toISOString().split('T')[0] : null,
      tipo_cobranca: p.purchase?.payment?.type,
      link: null,
      gateway: 'hotmart',
    }))

    return { data: payments, total: payments.length }
  } catch (err) {
    return { error: `Erro ao conectar no Hotmart: ${(err as Error).message}`, data: [] }
  }
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const gateway = searchParams.get('gateway') // asaas, stripe, mercadopago, hotmart, all

    const results: Record<string, unknown> = {}

    if (!gateway || gateway === 'all') {
      const [asaas, stripe, mp, hotmart] = await Promise.all([
        fetchAsaas(user.id),
        fetchStripe(user.id),
        fetchMercadoPago(user.id),
        fetchHotmart(user.id),
      ])
      results.asaas = asaas
      results.stripe = stripe
      results.mercadopago = mp
      results.hotmart = hotmart
    } else {
      switch (gateway) {
        case 'asaas': results.asaas = await fetchAsaas(user.id); break
        case 'stripe': results.stripe = await fetchStripe(user.id); break
        case 'mercadopago': results.mercadopago = await fetchMercadoPago(user.id); break
        case 'hotmart': results.hotmart = await fetchHotmart(user.id); break
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Gateway payments error:', error)
    return NextResponse.json({ error: 'Erro ao buscar pagamentos' }, { status: 500 })
  }
}
