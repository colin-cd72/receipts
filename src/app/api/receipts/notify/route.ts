import { NextResponse } from 'next/server'
import { getReceiptsNeedingFixEmail, generateEditToken, markFixEmailSent } from '@/lib/db'
import { sendFixReceiptEmail } from '@/lib/email'

export async function POST() {
  try {
    const receipts = getReceiptsNeedingFixEmail()

    if (receipts.length === 0) {
      return NextResponse.json({
        message: 'No receipts need fix notifications',
        sent: 0,
      })
    }

    const siteUrl = process.env.SITE_URL || 'https://receipts.co-l.in'
    let sent = 0
    const errors: string[] = []

    for (const receipt of receipts) {
      if (!receipt.uploader_email) continue

      // Generate edit token if not exists
      const token = receipt.edit_token || generateEditToken(receipt.id)

      const success = await sendFixReceiptEmail({
        uploaderName: receipt.uploader_name,
        uploaderEmail: receipt.uploader_email,
        receiptId: receipt.id,
        editToken: token,
        vendor: receipt.vendor,
        amount: receipt.amount,
        date: receipt.date,
        originalFilename: receipt.original_filename,
        imageUrl: `${siteUrl}/api/receipts/${receipt.id}/image`,
      })

      if (success) {
        markFixEmailSent(receipt.id)
        sent++
      } else {
        errors.push(`Failed to send to ${receipt.uploader_email} for receipt ${receipt.id}`)
      }
    }

    return NextResponse.json({
      message: `Sent ${sent} fix notification emails`,
      total: receipts.length,
      sent,
      errors,
    })
  } catch (error) {
    console.error('Error sending fix notifications:', error)
    return NextResponse.json(
      { error: 'Failed to send notifications' },
      { status: 500 }
    )
  }
}
