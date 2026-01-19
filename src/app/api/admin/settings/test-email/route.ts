import { NextRequest, NextResponse } from 'next/server'
import { sendTestEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, notifyEmail } = await request.json()

    if (!smtpHost || !smtpHost.trim()) {
      return NextResponse.json({ error: 'SMTP host is required' }, { status: 400 })
    }

    if (!smtpPort || !smtpPort.trim()) {
      return NextResponse.json({ error: 'SMTP port is required' }, { status: 400 })
    }

    if (!smtpUser || !smtpUser.trim()) {
      return NextResponse.json({ error: 'SMTP username is required' }, { status: 400 })
    }

    if (!smtpPass || !smtpPass.trim()) {
      return NextResponse.json({ error: 'SMTP password is required' }, { status: 400 })
    }

    if (!smtpFrom || !smtpFrom.trim()) {
      return NextResponse.json({ error: 'From address is required' }, { status: 400 })
    }

    if (!notifyEmail || !notifyEmail.trim()) {
      return NextResponse.json({ error: 'Notification email is required' }, { status: 400 })
    }

    const port = parseInt(smtpPort.trim(), 10)

    await sendTestEmail(
      {
        host: smtpHost.trim(),
        port,
        secure: port === 465,
        user: smtpUser.trim(),
        pass: smtpPass.trim(),
        from: smtpFrom.trim(),
      },
      notifyEmail.trim()
    )

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
