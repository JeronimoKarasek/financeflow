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
      .select('provedor, api_key, api_secret, access_token, webhook_url, ambiente, configuracoes_extra, ativa')
      .eq('usuario_id', user.id)

    // Converter para formato que o frontend espera (objeto 'credenciais')
    const integracoesFormatadas = (integracoes || []).map((integ: Record<string, unknown>) => {
      const extra = (integ.configuracoes_extra || {}) as Record<string, string>
      let credenciais: Record<string, string> = {}

      switch (integ.provedor) {
        case 'evolution':
          credenciais = {
            url: (integ.webhook_url as string) || '',
            api_key: (integ.api_key as string) || '',
            instance: extra.instance || '',
          }
          break
        case 'asaas':
          credenciais = {
            api_key: (integ.api_key as string) || '',
            sandbox: integ.ambiente === 'sandbox' ? 'true' : 'false',
          }
          break
        case 'stripe':
          credenciais = {
            publishable_key: (integ.api_key as string) || '',
            secret_key: (integ.api_secret as string) || '',
          }
          break
        case 'mercadopago':
          credenciais = {
            access_token: (integ.access_token as string) || '',
            public_key: (integ.api_key as string) || '',
          }
          break
        case 'hotmart':
          credenciais = {
            client_id: (integ.api_key as string) || '',
            client_secret: (integ.api_secret as string) || '',
            basic_token: (integ.access_token as string) || '',
          }
          break
      }

      return { provedor: integ.provedor, credenciais, ativa: integ.ativa }
    })

    return NextResponse.json({
      perfil: usuario,
      integracoes: integracoesFormatadas,
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
        const c = cred.credenciais || {}

        // Mapear para colunas reais da tabela conforme o provedor
        const mapped: Record<string, unknown> = {
          usuario_id: user.id,
          provedor: cred.provedor,
          nome: cred.provedor,
          ativa: cred.ativa ?? true,
        }

        switch (cred.provedor) {
          case 'evolution':
            mapped.api_key = c.api_key || null
            mapped.webhook_url = c.url || null
            mapped.configuracoes_extra = { instance: c.instance || '' }
            break
          case 'asaas':
            mapped.api_key = c.api_key || null
            mapped.ambiente = c.sandbox === 'true' ? 'sandbox' : 'producao'
            break
          case 'stripe':
            mapped.api_key = c.publishable_key || null
            mapped.api_secret = c.secret_key || null
            break
          case 'mercadopago':
            mapped.access_token = c.access_token || null
            mapped.api_key = c.public_key || null
            break
          case 'hotmart':
            mapped.api_key = c.client_id || null
            mapped.api_secret = c.client_secret || null
            mapped.access_token = c.basic_token || null
            break
          default:
            mapped.api_key = c.api_key || null
            mapped.api_secret = c.api_secret || c.secret_key || null
            mapped.access_token = c.access_token || null
        }

        const { data: existing } = await supabase
          .from('_financeiro_integracoes')
          .select('id')
          .eq('usuario_id', user.id)
          .eq('provedor', cred.provedor)
          .single()

        if (existing) {
          const { error: upErr } = await supabase
            .from('_financeiro_integracoes')
            .update(mapped)
            .eq('id', existing.id)
          if (upErr) console.error('Update integração error:', upErr)
        } else {
          const { error: insErr } = await supabase
            .from('_financeiro_integracoes')
            .insert(mapped)
          if (insErr) console.error('Insert integração error:', insErr)
        }
      }

      return NextResponse.json({ success: true, message: 'Credenciais salvas' })
    }

    if (tipo === 'notificacoes') {
      const { whatsapp_ativo, dias_antes_vencimento, notificar_atraso, notificar_recebimento, horario_envio } = body

      // Salvar na tabela de preferências de notificação (upsert)
      const { data: existing } = await supabase
        .from('_financeiro_preferencias_notificacao')
        .select('id')
        .eq('usuario_id', user.id)
        .single()

      const prefData = { usuario_id: user.id, whatsapp_ativo, dias_antes_vencimento, notificar_atraso, notificar_recebimento, horario_envio }

      if (existing) {
        await supabase.from('_financeiro_preferencias_notificacao').update(prefData).eq('id', existing.id)
      } else {
        await supabase.from('_financeiro_preferencias_notificacao').insert(prefData)
      }

      return NextResponse.json({ success: true, message: 'Preferências salvas' })
    }

    return NextResponse.json({ error: 'Tipo de atualização inválido' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
