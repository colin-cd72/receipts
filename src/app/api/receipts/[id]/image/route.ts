import { NextRequest, NextResponse } from 'next/server'
import { getReceipt } from '@/lib/db'
import { readFileSync, existsSync } from 'fs'
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

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Image file not found' }, { status: 404 })
    }

    const imageData = readFileSync(filePath)
    const ext = path.extname(receipt.filename).toLowerCase()

    let contentType = 'image/jpeg'
    if (ext === '.png') contentType = 'image/png'
    else if (ext === '.gif') contentType = 'image/gif'
    else if (ext === '.webp') contentType = 'image/webp'
    else if (ext === '.pdf') contentType = 'application/pdf'

    return new NextResponse(imageData, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error serving image:', error)
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 })
  }
}
