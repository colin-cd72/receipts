import { NextRequest, NextResponse } from 'next/server'
import { updateUser, deleteUser } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await request.json()
    const fields: { name?: string; active?: number; password?: string } = {}

    if (body.name !== undefined) fields.name = body.name
    if (body.active !== undefined) fields.active = body.active ? 1 : 0
    if (body.password) fields.password = body.password

    updateUser(userId, fields)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    deleteUser(userId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
