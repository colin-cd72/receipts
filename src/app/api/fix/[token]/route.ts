import { NextRequest, NextResponse } from 'next/server'
import { getReceiptByToken, updateReceipt, markFixCompleted } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const receipt = getReceiptByToken(token)

    if (!receipt) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    return NextResponse.json({
      receipt: {
        id: receipt.id,
        original_filename: receipt.original_filename,
        vendor: receipt.vendor,
        amount: receipt.amount,
        date: receipt.date,
        category: receipt.category,
        uploader_name: receipt.uploader_name,
      },
    })
  } catch (error) {
    console.error('Error fetching receipt by token:', error)
    return NextResponse.json(
      { error: 'Failed to fetch receipt' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const receipt = getReceiptByToken(token)

    if (!receipt) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    const body = await request.json()
    const { vendor, amount, date, category } = body

    // Validate required fields
    if (!vendor || !amount || !date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Update the receipt
    updateReceipt(receipt.id, {
      vendor,
      amount: parseFloat(amount),
      date,
      category: category || null,
    })

    // Mark as completed
    markFixCompleted(receipt.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating receipt:', error)
    return NextResponse.json(
      { error: 'Failed to update receipt' },
      { status: 500 }
    )
  }
}
