import { NextResponse } from 'next/server'
import { getAllInboundEmails, getReceiptsByInboundEmailId } from '@/lib/db'

export async function GET() {
  try {
    const emails = getAllInboundEmails()
    const emailsWithReceipts = emails.map((email) => ({
      ...email,
      receipts: getReceiptsByInboundEmailId(email.id),
    }))
    return NextResponse.json({ emails: emailsWithReceipts })
  } catch (error) {
    console.error('Error fetching inbound emails:', error)
    return NextResponse.json({ error: 'Failed to fetch inbound emails' }, { status: 500 })
  }
}
