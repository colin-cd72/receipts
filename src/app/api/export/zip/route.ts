import { NextResponse } from 'next/server'
import { getAllReceipts } from '@/lib/db'
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import { PassThrough } from 'stream'

export async function GET() {
  try {
    const receipts = getAllReceipts()

    // Create a pass-through stream
    const passThrough = new PassThrough()

    // Create archiver instance
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    })

    // Pipe archive to the pass-through stream
    archive.pipe(passThrough)

    // Group receipts by date for folder organization
    const receiptsByDate: Record<string, typeof receipts> = {}

    for (const receipt of receipts) {
      const date = receipt.date || 'unknown-date'
      if (!receiptsByDate[date]) {
        receiptsByDate[date] = []
      }
      receiptsByDate[date].push(receipt)
    }

    // Add files to archive organized by date folders
    for (const [date, dateReceipts] of Object.entries(receiptsByDate)) {
      for (const receipt of dateReceipts) {
        const filePath = path.join(process.cwd(), 'data', 'uploads', receipt.filename)

        if (fs.existsSync(filePath)) {
          const ext = path.extname(receipt.original_filename).toLowerCase()
          const vendor = (receipt.vendor || 'unknown').replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)
          const amount = receipt.amount ? receipt.amount.toFixed(2) : '0.00'
          const smartFilename = `${vendor}_$${amount}${ext}`

          // Add to archive with date folder structure
          archive.file(filePath, {
            name: `${date}/${smartFilename}`,
          })
        }
      }
    }

    // Finalize the archive
    archive.finalize()

    // Convert stream to buffer for NextResponse
    const chunks: Buffer[] = []
    for await (const chunk of passThrough) {
      chunks.push(chunk as Buffer)
    }
    const buffer = Buffer.concat(chunks)

    const today = new Date().toISOString().split('T')[0]

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="receipts-${today}.zip"`,
      },
    })
  } catch (error) {
    console.error('ZIP export error:', error)
    return NextResponse.json({ error: 'Failed to create ZIP' }, { status: 500 })
  }
}
