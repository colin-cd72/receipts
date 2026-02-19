import { NextRequest, NextResponse } from 'next/server'
import { getInboundEmail, deleteInboundEmail, getReceiptsByInboundEmailId, deleteReceipt } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const email = getInboundEmail(parseInt(id, 10))
  if (!email) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const receipts = getReceiptsByInboundEmailId(email.id)
  return NextResponse.json({ email, receipts })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const emailId = parseInt(id, 10)
  const email = getInboundEmail(emailId)
  if (!email) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Delete linked receipts and their files
  const receipts = getReceiptsByInboundEmailId(emailId)
  for (const receipt of receipts) {
    const filePath = path.join(process.cwd(), 'data', 'uploads', receipt.filename)
    try { fs.unlinkSync(filePath) } catch { /* file may not exist */ }
    deleteReceipt(receipt.id)
  }

  deleteInboundEmail(emailId)
  return NextResponse.json({ success: true })
}
