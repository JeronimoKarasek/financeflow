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

    const supabase = createServerSupabase()
    const { data: usuario, error } = await supabase
      .from('_financeiro_usuarios')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('ativo', true)
      .single()

    if (error || !usuario) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash)
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
