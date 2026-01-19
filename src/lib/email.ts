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
