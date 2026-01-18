import { Resend } from 'resend'

interface ReceiptNotificationData {
  uploaderName: string
  uploaderEmail: string | null
  vendor: string | null
  amount: number | null
  currency: string
  date: string | null
  category: string | null
  originalFilename: string
}

export async function sendReceiptNotification(data: ReceiptNotificationData): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const notifyEmail = process.env.NOTIFY_EMAIL

  if (!apiKey || !notifyEmail) {
    console.log('Email notifications not configured (missing RESEND_API_KEY or NOTIFY_EMAIL)')
    return false
  }

  try {
    const resend = new Resend(apiKey)

    const amountStr = data.amount
      ? `${data.currency} ${data.amount.toFixed(2)}`
      : 'Not detected'

    const { error } = await resend.emails.send({
      from: 'Receipts <receipts@' + (process.env.RESEND_DOMAIN || 'resend.dev') + '>',
      to: notifyEmail,
      subject: `New Receipt: ${data.vendor || data.originalFilename} - ${amountStr}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">New Receipt Uploaded</h2>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 140px;">Uploaded By:</td>
              <td style="padding: 8px 0; font-weight: 500;">${data.uploaderName}${data.uploaderEmail ? ` (${data.uploaderEmail})` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Vendor:</td>
              <td style="padding: 8px 0; font-weight: 500;">${data.vendor || 'Not detected'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
              <td style="padding: 8px 0; font-weight: 500; color: #059669;">${amountStr}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date:</td>
              <td style="padding: 8px 0; font-weight: 500;">${data.date || 'Not detected'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Category:</td>
              <td style="padding: 8px 0; font-weight: 500;">${data.category || 'Not detected'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">File:</td>
              <td style="padding: 8px 0; font-weight: 500;">${data.originalFilename}</td>
            </tr>
          </table>

          <div style="margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
            <a href="${process.env.SITE_URL || 'https://receipts.co-l.in'}/admin"
               style="color: #3b82f6; text-decoration: none; font-weight: 500;">
              View in Admin Dashboard →
            </a>
          </div>

          <p style="margin-top: 30px; color: #9ca3af; font-size: 12px;">
            This is an automated notification from your receipt management system.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send email:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Email error:', error)
    return false
  }
}
