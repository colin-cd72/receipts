import { NextRequest, NextResponse } from 'next/server'
import { getReceipt } from '@/lib/db'
import fs from 'fs'
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

    const filePath = path.join(process.cwd(), 'data', 'uploads', receipt.filename)

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileData = fs.readFileSync(filePath)
    const ext = path.extname(receipt.original_filename).toLowerCase()

    // Get custom filename from query param or generate smart filename
    const { searchParams } = new URL(request.url)
    let filename = searchParams.get('filename')

    if (!filename) {
      // Generate smart filename: date_vendor_amount.ext
      const date = receipt.date || 'unknown-date'
      const vendor = (receipt.vendor || 'unknown').replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)
      const amount = receipt.amount ? receipt.amount.toFixed(2) : '0.00'
      filename = `${date}_${vendor}_$${amount}${ext}`
    }

    // Determine content type
    let contentType = 'application/octet-stream'
    if (ext === '.pdf') contentType = 'application/pdf'
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    else if (ext === '.png') contentType = 'image/png'
    else if (ext === '.gif') contentType = 'image/gif'
    else if (ext === '.webp') contentType = 'image/webp'

    return new NextResponse(fileData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Failed to download' }, { status: 500 })
  }
}
