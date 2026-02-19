import { NextResponse } from 'next/server'
import { getAllReceipts } from '@/lib/db'
import { uploadReceiptToDropbox, isDropboxConfigured } from '@/lib/dropbox'

export async function POST() {
  try {
    if (!isDropboxConfigured()) {
      return NextResponse.json(
        { error: 'Dropbox is not configured. Please add your access token in settings.' },
        { status: 400 }
      )
    }

    const receipts = getAllReceipts()
    const processedReceipts = receipts.filter(r => r.status === 'processed')
    const notProcessedCount = receipts.length - processedReceipts.length

    const results = {
      total: processedReceipts.length,
      success: 0,
      failed: 0,
      skipped: notProcessedCount,
      alreadyInDropbox: 0,
      errors: [] as string[],
      uploaded: [] as string[],
    }

    for (const receipt of processedReceipts) {
      const result = await uploadReceiptToDropbox(
        receipt.filename,
        receipt.vendor,
        receipt.amount,
        receipt.date,
        receipt.original_filename,
        true // skipIfExists
      )

      if (result.success) {
        if (result.skipped) {
          results.alreadyInDropbox++
        } else {
          results.success++
          results.uploaded.push(receipt.original_filename)
        }
      } else {
        results.failed++
        if (result.error) {
          results.errors.push(`${receipt.original_filename}: ${result.error}`)
        }
      }
    }

    return NextResponse.json({
      message: `Synced ${results.success} receipts to Dropbox`,
      ...results,
    })
  } catch (error) {
    console.error('Dropbox sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync to Dropbox' },
      { status: 500 }
    )
  }
}
