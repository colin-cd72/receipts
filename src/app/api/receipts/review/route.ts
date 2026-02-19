import { NextResponse } from 'next/server'
import { getReceiptsForReview } from '@/lib/db'

export async function GET() {
  try {
    const receipts = getReceiptsForReview()
    return NextResponse.json({ receipts })
  } catch (error) {
    console.error('Error fetching receipts for review:', error)
    return NextResponse.json(
      { error: 'Failed to fetch receipts' },
      { status: 500 }
    )
  }
}
