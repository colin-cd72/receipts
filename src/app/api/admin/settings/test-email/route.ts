import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    const { resendApiKey, notifyEmail } = await request.json()

    if (!resendApiKey || !resendApiKey.trim()) {
      return NextResponse.json({ error: 'Resend API key is required' }, { status: 400 })
    }

    if (!notifyEmail || !notifyEmail.trim()) {
      return NextResponse.json({ error: 'Notification email is required' }, { status: 400 })
    }

    const resend = new Resend(resendApiKey.trim())

    const { error } = await resend.emails.send({
      from: 'Receipts <onboarding@resend.dev>',
      to: notifyEmail.trim(),
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
              <strong>Configuration successful!</strong>
            </p>
          </div>

          <p style="margin-top: 30px; color: #9ca3af; font-size: 12px;">
            This is an automated test email from your receipt management system.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Test email error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to send test email' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Test email error:', error)
    const err = error as { message?: string }
    return NextResponse.json(
      { error: err.message || 'Failed to send test email' },
      { status: 500 }
    )
  }
}
