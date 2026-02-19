import nodemailer from 'nodemailer'

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

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM

  if (!host || !port || !user || !pass || !from) {
    return null
  }

  return {
    host,
    port: parseInt(port, 10),
    secure: parseInt(port, 10) === 465,
    user,
    pass,
    from,
  }
}

export async function sendReceiptNotification(data: ReceiptNotificationData): Promise<boolean> {
  const config = getSmtpConfig()
  const notifyEmail = process.env.NOTIFY_EMAIL

  if (!config || !notifyEmail) {
    console.log('Email notifications not configured (missing SMTP settings or NOTIFY_EMAIL)')
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    })

    const amountStr = data.amount
      ? `${data.currency} ${data.amount.toFixed(2)}`
      : 'Not detected'

    await transporter.sendMail({
      from: config.from,
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

          <div style="margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px; display: flex; gap: 20px;">
            <a href="${process.env.SITE_URL || 'https://receipts.co-l.in'}/admin"
               style="color: #3b82f6; text-decoration: none; font-weight: 500;">
              View in Admin Dashboard →
            </a>
            <a href="${process.env.SITE_URL || 'https://receipts.co-l.in'}/api/export/zip"
               style="color: #7c3aed; text-decoration: none; font-weight: 500;">
              Download All Receipts (ZIP) →
            </a>
          </div>

          <p style="margin-top: 30px; color: #9ca3af; font-size: 12px;">
            This is an automated notification from your receipt management system.
          </p>
        </div>
      `,
    })

    return true
  } catch (error) {
    console.error('Email error:', error)
    return false
  }
}

interface FixReceiptData {
  uploaderName: string
  uploaderEmail: string
  receiptId: number
  editToken: string
  vendor: string | null
  amount: number | null
  date: string | null
  originalFilename: string
  imageUrl: string
}

export async function sendFixReceiptEmail(data: FixReceiptData): Promise<boolean> {
  const config = getSmtpConfig()

  if (!config) {
    console.log('Email notifications not configured (missing SMTP settings)')
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    })

    const siteUrl = process.env.SITE_URL || 'https://receipts.co-l.in'
    const fixUrl = `${siteUrl}/fix/${data.editToken}`

    // Determine what fields are missing
    const missingFields: string[] = []
    if (!data.vendor) missingFields.push('Vendor/Merchant')
    if (!data.amount) missingFields.push('Amount')
    if (!data.date || data.date < '2025-10-01') missingFields.push('Date')

    const missingFieldsHtml = missingFields
      .map(f => `<li style="color: #dc2626; padding: 4px 0;">${f}</li>`)
      .join('')

    await transporter.sendMail({
      from: config.from,
      to: data.uploaderEmail,
      subject: `Action Required: Please complete your receipt - ${data.originalFilename}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">Receipt Needs Your Attention</h2>

          <p style="color: #4b5563; line-height: 1.6;">
            Hi ${data.uploaderName},
          </p>

          <p style="color: #4b5563; line-height: 1.6;">
            We couldn't automatically extract all the information from your receipt. Please help us by filling in the missing details.
          </p>

          <div style="margin: 20px 0; padding: 15px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0 0 10px 0; font-weight: 600; color: #92400e;">Missing Information:</p>
            <ul style="margin: 0; padding-left: 20px;">
              ${missingFieldsHtml}
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${fixUrl}"
               style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Fix This Receipt
            </a>
          </div>

          <div style="margin: 20px 0; padding: 15px; background: #f3f4f6; border-radius: 8px;">
            <p style="margin: 0 0 10px 0; font-weight: 600; color: #374151;">Your Receipt:</p>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">File: ${data.originalFilename}</p>
            ${data.vendor ? `<p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Vendor: ${data.vendor}</p>` : ''}
            ${data.amount ? `<p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Amount: $${data.amount.toFixed(2)}</p>` : ''}
            ${data.date ? `<p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Date: ${data.date}</p>` : ''}
          </div>

          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
            <strong>Receipt Image:</strong>
          </p>
          <div style="margin: 10px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <img src="${data.imageUrl}" alt="Receipt" style="max-width: 100%; height: auto; display: block;" />
          </div>

          <p style="margin-top: 30px; color: #9ca3af; font-size: 12px;">
            This link is unique to this receipt. Please don't share it with others.
          </p>
          <img src="${siteUrl}/api/track/${data.editToken}" width="1" height="1" alt="" style="display:none;" />
        </div>
      `,
    })

    return true
  } catch (error) {
    console.error('Fix receipt email error:', error)
    return false
  }
}

export async function sendTestEmail(config: SmtpConfig, toEmail: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  await transporter.sendMail({
    from: config.from,
    to: toEmail,
    subject: 'Test Email - Receipt Notifications',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">Email Notifications Working!</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          This is a test email from your receipt management system. If you received this,
          your email notifications are configured correctly.
        </p>

        <p style="color: #4b5563; line-height: 1.6;">
          You will receive notifications like this whenever a new receipt is uploaded and processed.
        </p>

        <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
          <p style="margin: 0; color: #166534;">
            <strong>SMTP Configuration successful!</strong>
          </p>
        </div>

        <p style="margin-top: 30px; color: #9ca3af; font-size: 12px;">
          This is an automated test email from your receipt management system.
        </p>
      </div>
    `,
  })
}
