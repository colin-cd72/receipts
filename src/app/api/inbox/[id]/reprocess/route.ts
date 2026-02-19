import { NextRequest, NextResponse } from 'next/server'
import { getInboundEmail, getReceiptsByInboundEmailId, updateReceipt, updateInboundEmail, generateEditToken } from '@/lib/db'
import { analyzeReceipt } from '@/lib/claude'
import { uploadReceiptToDropbox } from '@/lib/dropbox'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const emailId = parseInt(id, 10)
  const email = getInboundEmail(emailId)
  if (!email) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const receipts = getReceiptsByInboundEmailId(emailId)
  if (receipts.length === 0) {
    return NextResponse.json({ error: 'No receipts linked to this email' }, { status: 400 })
  }

  updateInboundEmail(emailId, { status: 'processing' })

  // Reprocess all linked receipts
  const results = []
  for (const receipt of receipts) {
    try {
      updateReceipt(receipt.id, { status: 'processing' })
      const analysis = await analyzeReceipt(receipt.filename)

      updateReceipt(receipt.id, {
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

      await uploadReceiptToDropbox(
        receipt.filename,
        analysis.vendor || null,
        analysis.amount || null,
        analysis.date || null,
        receipt.original_filename
      )

      results.push({ id: receipt.id, status: 'processed' })
    } catch (error) {
      console.error(`Reprocess error for receipt ${receipt.id}:`, error)
      updateReceipt(receipt.id, { status: 'error', raw_text: `Reprocess error: ${error}` })
      results.push({ id: receipt.id, status: 'error' })
    }
  }

  updateInboundEmail(emailId, { status: 'processed', processed_at: new Date().toISOString() })

  return NextResponse.json({ success: true, results })
}
