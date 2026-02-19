import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'

export async function POST(request: NextRequest) {
  try {
    const { imapHost, imapPort, imapUser, imapPass, imapMailbox } = await request.json()

    if (!imapHost?.trim()) return NextResponse.json({ error: 'IMAP host is required' }, { status: 400 })
    if (!imapUser?.trim()) return NextResponse.json({ error: 'IMAP username is required' }, { status: 400 })
    if (!imapPass?.trim()) return NextResponse.json({ error: 'IMAP password is required' }, { status: 400 })

    const port = parseInt(imapPort || '993', 10)
    const mailbox = imapMailbox?.trim() || 'INBOX'
    const startTime = Date.now()
    const logs: string[] = []

    logs.push(`Connecting to ${imapHost.trim()}:${port} (TLS: ${port === 993}) as ${imapUser.trim()}`)
    logs.push(`Mailbox: ${mailbox}`)

    const client = new ImapFlow({
      host: imapHost.trim(),
      port,
      secure: port === 993,
      auth: {
        user: imapUser.trim(),
        pass: imapPass.trim(),
      },
      tls: { rejectUnauthorized: false },
      logger: {
        debug: (msg: { msg: string }) => logs.push(`[DEBUG] ${msg.msg}`),
        info: (msg: { msg: string }) => logs.push(`[INFO] ${msg.msg}`),
        warn: (msg: { msg: string }) => logs.push(`[WARN] ${msg.msg}`),
        error: (msg: { msg: string }) => logs.push(`[ERROR] ${msg.msg}`),
      },
    })

    try {
      await client.connect()
      const elapsed = Date.now() - startTime
      logs.push(`Connected and authenticated in ${elapsed}ms`)

      const status = await client.status(mailbox, { messages: true, unseen: true, recent: true })
      logs.push(`Mailbox status: ${status.messages} total, ${status.unseen} unseen, ${status.recent} recent`)
      logs.push(`Total time: ${Date.now() - startTime}ms`)

      await client.logout()

      return NextResponse.json({
        success: true,
        messages: status.messages,
        recent: status.recent,
        unseen: status.unseen,
        logs,
      })
    } catch (err: unknown) {
      const elapsed = Date.now() - startTime
      const error = err as { message?: string; responseText?: string; code?: string }
      const msg = error.responseText || error.message || String(err)
      logs.push(`ERROR after ${elapsed}ms: ${msg}`)

      let diagnostic = msg
      if (msg.includes('Authentication') || msg.includes('auth') || msg.includes('LOGIN') || msg.includes('AUTHENTICATIONFAILED')) {
        diagnostic = `Authentication failed for "${imapUser.trim()}". Check: (1) Password is correct, (2) For Gmail use an App Password, (3) Account is not locked/disabled, (4) IMAP access is enabled in email provider settings.`
      } else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
        diagnostic = `DNS lookup failed for "${imapHost.trim()}". Check the hostname is correct.`
      } else if (msg.includes('ECONNREFUSED')) {
        diagnostic = `Connection refused at ${imapHost.trim()}:${port}. Check host and port.`
      } else if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
        diagnostic = `Connection timed out. Check host, port, and firewall.`
      }

      try { await client.logout() } catch { /* ignore */ }

      return NextResponse.json({ error: diagnostic, logs }, { status: 400 })
    }
  } catch (error: unknown) {
    console.error('Test IMAP error:', error)
    const err = error as { message?: string }
    return NextResponse.json({ error: err.message || 'Failed to test IMAP connection' }, { status: 500 })
  }
}
