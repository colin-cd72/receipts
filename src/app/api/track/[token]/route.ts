import { NextRequest, NextResponse } from 'next/server'
import { markFixEmailOpened } from '@/lib/db'

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Mark email as opened
    markFixEmailOpened(token)
    console.log('Email opened for token:', token)

    // Return transparent 1x1 GIF
    return new NextResponse(TRANSPARENT_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Tracking error:', error)
    // Still return the pixel even on error
    return new NextResponse(TRANSPARENT_GIF, {
      headers: {
        'Content-Type': 'image/gif',
      },
    })
  }
}
