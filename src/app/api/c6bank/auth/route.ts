import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { c6Authenticate, buildC6Config } from '@/lib/c6bank'

export const dynamic = 'force-dynamic'

// Buscar configuração C6 do banco
async function getC6Integracao() {
  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('_financeiro_integracoes')
    .select('*')
    .eq('provedor', 'c6bank')
    .eq('ativa', true)
    .single()

  if (error || !data) return null
  return data
}

// GET - Status da conexão C6
export async function GET() {
  try {
    const integ = await getC6Integracao()
    if (!integ) {
      return NextResponse.json({
        connected: false,
        message: 'C6 Bank não configurado. Vá em Integrações e configure o C6 Bank.',
      })
    }

    const config = buildC6Config(integ)
    try {
      const tokenData = await c6Authenticate(config)
      return NextResponse.json({
        connected: true,
        ambiente: integ.ambiente,
        token_expires_in: tokenData.expires_in,
        pix_key: config.pixKey || null,
        webhook_url: integ.webhook_url || null,
        message: 'Conectado ao C6 Bank com sucesso',
      })
    } catch (authError) {
      return NextResponse.json({
        connected: false,
        ambiente: integ.ambiente,
        message: `Não foi possível autenticar: ${authError instanceof Error ? authError.message : 'Erro desconhecido'}`,
      })
    }
  } catch (error) {
    console.error('C6 Auth GET error:', error)
    return NextResponse.json({ error: 'Erro ao verificar conexão C6 Bank' }, { status: 500 })
  }
}

// POST - Testar conexão / autenticar
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clientId, clientSecret, ambiente } = body

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Client ID e Client Secret são obrigatórios' }, { status: 400 })
    }

    const config = {
      clientId,
      clientSecret,
      pixKey: body.pixKey || '',
      ambiente: ambiente === 'producao' ? 'producao' as const : 'sandbox' as const,
    }

    const tokenData = await c6Authenticate(config)
    return NextResponse.json({
      success: true,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      message: 'Autenticação C6 Bank bem sucedida!',
    })
  } catch (error) {
    console.error('C6 Auth POST error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Falha na autenticação',
    }, { status: 401 })
  }
}
