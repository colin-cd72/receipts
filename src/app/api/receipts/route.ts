import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { insertReceipt, updateReceipt, getAllReceipts } from '@/lib/db'
import { analyzeReceipt } from '@/lib/claude'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null
    const email = formData.get('email') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate unique filename
    const ext = path.extname(file.name)
    const uniqueFilename = `${randomUUID()}${ext}`

    // Save file to uploads directory
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const uploadPath = path.join(process.cwd(), 'data', 'uploads', uniqueFilename)
    await writeFile(uploadPath, buffer)

    // Insert receipt record
    const receiptId = insertReceipt({
      filename: uniqueFilename,
      original_filename: file.name,
      uploader_name: name.trim(),
      uploader_email: email?.trim() || undefined,
    })

    // Process with Claude (async - don't wait for response)
    processReceiptAsync(receiptId, uniqueFilename)

    return NextResponse.json({
      success: true,
      message: 'Receipt uploaded and being processed',
      receiptId,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload receipt' },
      { status: 500 }
    )
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

export async function GET() {
  try {
    const receipts = getAllReceipts()
    return NextResponse.json({ receipts })
  } catch (error) {
    console.error('Error fetching receipts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch receipts' },
      { status: 500 }
    )
  }
}
