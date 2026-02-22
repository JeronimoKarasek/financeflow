import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { jwtVerify } from 'jose'

export const dynamic = 'force-dynamic'

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)

// Helper para extrair usuario_id do token
async function getUserFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(/ff-token=([^;]+)/)
  if (!match) return null
  try {
    const { payload } = await jwtVerify(match[1], SECRET!)
    return payload as { id: string; email: string; nome: string; role: string }
  } catch {
    return null
  }
}

// GET - Carregar configurações do usuário
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabase = createServerSupabase()

    const { data: usuario } = await supabase
      .from('_financeiro_usuarios')
      .select('id, nome, email, telefone, role, avatar_url')
      .eq('id', user.id)
      .single()

    // Buscar integrações do usuário
    const { data: integracoes } = await supabase
      .from('_financeiro_integracoes')
      .select('provedor, credenciais, ativa')
      .eq('usuario_id', user.id)

    return NextResponse.json({
      perfil: usuario,
      integracoes: integracoes || [],
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT - Atualizar perfil
export async function PUT(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { tipo } = body // 'perfil', 'senha', 'apis', 'notificacoes'

    const supabase = createServerSupabase()

    if (tipo === 'perfil') {
      const { nome, telefone } = body
      const { error } = await supabase
        .from('_financeiro_usuarios')
        .update({ nome, telefone })
        .eq('id', user.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, message: 'Perfil atualizado' })
    }

    if (tipo === 'senha') {
      const { senha_atual, senha_nova } = body

      if (!senha_atual || !senha_nova) {
        return NextResponse.json({ error: 'Senhas são obrigatórias' }, { status: 400 })
      }

      if (senha_nova.length < 6) {
        return NextResponse.json({ error: 'A nova senha deve ter no mínimo 6 caracteres' }, { status: 400 })
      }

      // Verificar senha atual
      const { data: usuario } = await supabase
        .from('_financeiro_usuarios')
        .select('senha_hash')
        .eq('id', user.id)
        .single()

      if (!usuario) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
      }

      const senhaValida = await bcrypt.compare(senha_atual, usuario.senha_hash)
      if (!senhaValida) {
        return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 })
      }

      const novoHash = await bcrypt.hash(senha_nova, 12)
      const { error } = await supabase
        .from('_financeiro_usuarios')
        .update({ senha_hash: novoHash })
        .eq('id', user.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, message: 'Senha alterada com sucesso' })
    }

    if (tipo === 'apis') {
      const { credenciais } = body // Array de { provedor, credenciais, ativa }

      if (!credenciais || !Array.isArray(credenciais)) {
        return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 400 })
      }

      for (const cred of credenciais) {
        const { data: existing } = await supabase
          .from('_financeiro_integracoes')
          .select('id')
          .eq('usuario_id', user.id)
          .eq('provedor', cred.provedor)
          .single()

        if (existing) {
          await supabase
            .from('_financeiro_integracoes')
            .update({ credenciais: cred.credenciais, ativa: cred.ativa ?? true })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('_financeiro_integracoes')
            .insert({
              usuario_id: user.id,
              provedor: cred.provedor,
              credenciais: cred.credenciais,
              ativa: cred.ativa ?? true,
            })
        }
      }

      return NextResponse.json({ success: true, message: 'Credenciais salvas' })
    }

    return NextResponse.json({ error: 'Tipo de atualização inválido' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
