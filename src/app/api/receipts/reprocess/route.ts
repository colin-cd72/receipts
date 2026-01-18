import { NextRequest, NextResponse } from 'next/server'
import { getAllReceipts, updateReceipt, getReceipt } from '@/lib/db'
import { analyzeReceipt } from '@/lib/claude'

// Reprocess a single receipt
export async function POST(request: NextRequest) {
  try {
    const { id, all } = await request.json()

    if (all) {
      // Reprocess all pending/error receipts AND processed ones with no data
      const receipts = getAllReceipts()
      const toReprocess = receipts.filter(
        (r) =>
          r.status === 'pending' ||
          r.status === 'error' ||
          r.status === 'processing' ||
          (r.status === 'processed' && !r.vendor && !r.amount)
      )

      // Process in background
      processMultipleReceipts(toReprocess.map((r) => ({ id: r.id, filename: r.filename })))

      return NextResponse.json({
        success: true,
        message: `Reprocessing ${toReprocess.length} receipts`,
        count: toReprocess.length,
      })
    }

    if (id) {
      const receipt = getReceipt(id)
      if (!receipt) {
        return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
      }

      // Process single receipt in background
      processReceiptAsync(id, receipt.filename)

      return NextResponse.json({
        success: true,
        message: 'Reprocessing receipt',
      })
    }

    return NextResponse.json({ error: 'Provide id or all=true' }, { status: 400 })
  } catch (error) {
    console.error('Reprocess error:', error)
    return NextResponse.json({ error: 'Failed to reprocess' }, { status: 500 })
  }
}

async function processMultipleReceipts(receipts: { id: number; filename: string }[]) {
  for (const receipt of receipts) {
    await processReceiptAsync(receipt.id, receipt.filename)
    // Small delay between processing to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

async function processReceiptAsync(receiptId: number, filename: string) {
  try {
    updateReceipt(receiptId, { status: 'processing' })

    const analysis = await analyzeReceipt(filename)

    updateReceipt(receiptId, {
      vendor: analysis.vendor || undefined,
      amount: analysis.amount || undefined,
      currency: analysis.currency || 'USD',
      date: analysis.date || undefined,
      category: analysis.category || undefined,
      description: analysis.description || undefined,
      payment_method: analysis.payment_method || undefined,
      raw_text: analysis.raw_text || undefined,
      status: 'processed',
      processed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Processing error for receipt', receiptId, error)
    updateReceipt(receiptId, {
      status: 'error',
      raw_text: `Processing error: ${error}`,
    })
  }
}
