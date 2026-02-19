import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = authenticateUser(email, password)

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    return NextResponse.json({ success: true, name: user.name, email: user.email })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
