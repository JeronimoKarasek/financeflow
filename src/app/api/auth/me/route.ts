import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('ff-token')?.value

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const { payload } = await jwtVerify(token, SECRET)
    
    return NextResponse.json({
      user: {
        id: payload.id,
        email: payload.email,
        nome: payload.nome,
        role: payload.role,
        avatar_url: payload.avatar_url,
      },
    })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
