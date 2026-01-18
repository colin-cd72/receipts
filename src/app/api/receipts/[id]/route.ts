import { NextRequest, NextResponse } from 'next/server'
import { getReceipt, updateReceipt, deleteReceipt } from '@/lib/db'
import { unlink } from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const receipt = getReceipt(parseInt(id))

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    return NextResponse.json({ receipt })
  } catch (error) {
    console.error('Error fetching receipt:', error)
    return NextResponse.json(
      { error: 'Failed to fetch receipt' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const receipt = getReceipt(parseInt(id))
    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    updateReceipt(parseInt(id), body)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating receipt:', error)
    return NextResponse.json(
      { error: 'Failed to update receipt' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const receipt = getReceipt(parseInt(id))

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    // Delete file
    const filePath = path.join(process.cwd(), 'data', 'uploads', receipt.filename)
    try {
      await unlink(filePath)
    } catch {
      // File might not exist, that's okay
    }

    // Delete database record
    deleteReceipt(parseInt(id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting receipt:', error)
    return NextResponse.json(
      { error: 'Failed to delete receipt' },
      { status: 500 }
    )
  }
}
