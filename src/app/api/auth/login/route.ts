import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

export const dynamic = 'force-dynamic'

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'financeflow-secret')

export async function POST(request: Request) {
  try {
    const { email, senha } = await request.json()

    if (!email || !senha) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    console.log('[LOGIN] Tentativa:', email)
    console.log('[LOGIN] SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30))
    console.log('[LOGIN] SERVICE_KEY existe:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    const supabase = createServerSupabase()
    
    // Primeiro, buscar sem filtro de ativo para debug
    const { data: usuario, error } = await supabase
      .from('_financeiro_usuarios')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single()

    console.log('[LOGIN] Query error:', error?.message || 'nenhum')
    console.log('[LOGIN] Usuário encontrado:', !!usuario)
    if (usuario) {
      console.log('[LOGIN] Ativo:', usuario.ativo)
      console.log('[LOGIN] Hash (primeiros 20):', usuario.senha_hash?.substring(0, 20))
    }

    if (error || !usuario) {
      return NextResponse.json({ 
        error: 'Credenciais inválidas',
        debug: { dbError: error?.message, code: error?.code }
      }, { status: 401 })
    }

    if (!usuario.ativo) {
      return NextResponse.json({ error: 'Usuário desativado' }, { status: 401 })
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash)
    console.log('[LOGIN] Senha válida:', senhaValida)
    
    if (!senhaValida) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    // Atualizar último acesso
    await supabase
      .from('_financeiro_usuarios')
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq('id', usuario.id)

    // Gerar JWT
    const token = await new SignJWT({
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      role: usuario.role,
      avatar_url: usuario.avatar_url,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .setIssuedAt()
      .sign(SECRET)

    const response = NextResponse.json({
      success: true,
      user: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        role: usuario.role,
        avatar_url: usuario.avatar_url,
      },
    })

    response.cookies.set('ff-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
