import { NextRequest, NextResponse } from 'next/server'
import { getAllAllowedSenders, addAllowedSender, removeAllowedSender } from '@/lib/db'

export async function GET() {
  try {
    const senders = getAllAllowedSenders()
    return NextResponse.json({ senders })
  } catch (error) {
    console.error('Error fetching allowed senders:', error)
    return NextResponse.json({ error: 'Failed to fetch allowed senders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address required' }, { status: 400 })
    }
    const id = addAllowedSender(email, name)
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Error adding allowed sender:', error)
    return NextResponse.json({ error: 'Failed to add sender' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }
    removeAllowedSender(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing allowed sender:', error)
    return NextResponse.json({ error: 'Failed to remove sender' }, { status: 500 })
  }
}
