import { NextRequest, NextResponse } from 'next/server'
import Imap from 'imap'

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

    const result = await new Promise<{
      success: boolean
      messages?: number
      recent?: number
      unseen?: number
      error?: string
      capabilities?: string
    }>((resolve) => {
      const timeout = setTimeout(() => {
        logs.push(`TIMEOUT after 15s`)
        resolve({ success: false, error: `Connection timed out after 15 seconds. Check host and port.` })
      }, 15000)

      const imap = new Imap({
        user: imapUser.trim(),
        password: imapPass.trim(),
        host: imapHost.trim(),
        port,
        tls: port === 993,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 10000,
        authTimeout: 10000,
        debug: (msg: string) => {
          // Capture protocol-level messages for diagnostics
          // Redact password from debug output
          const clean = msg.replace(/AUTHENTICATE PLAIN .+/, 'AUTHENTICATE PLAIN ***REDACTED***')
            .replace(/LOGIN "[^"]*" "[^"]*"/, 'LOGIN "***" "***"')
          logs.push(clean)
        },
      })

      imap.once('ready', () => {
        const elapsed = Date.now() - startTime
        logs.push(`Connected and authenticated in ${elapsed}ms`)

        imap.openBox(mailbox, true, (err: Error | null, box: Imap.Box) => {
          clearTimeout(timeout)
          if (err) {
            logs.push(`ERROR opening mailbox: ${err.message}`)
            imap.end()
            resolve({ success: false, error: `Failed to open mailbox "${mailbox}": ${err.message}` })
            return
          }

          logs.push(`Mailbox opened: ${box.messages.total} total, ${box.messages.new} recent`)

          // Count unseen messages
          imap.search(['UNSEEN'], (searchErr: Error | null, uids: number[]) => {
            const unseen = searchErr ? 0 : (uids?.length || 0)
            logs.push(`Unseen messages: ${unseen}`)
            logs.push(`Total time: ${Date.now() - startTime}ms`)
            imap.end()
            resolve({
              success: true,
              messages: box.messages.total,
              recent: box.messages.new,
              unseen,
            })
          })
        })
      })

      imap.once('error', (err: Error) => {
        clearTimeout(timeout)
        const elapsed = Date.now() - startTime
        logs.push(`ERROR after ${elapsed}ms: ${err.message}`)

        // Provide helpful diagnostics based on error type
        let diagnostic = err.message
        if (err.message.includes('Authentication failed') || err.message.includes('AUTHENTICATIONFAILED')) {
          diagnostic = `Authentication failed for "${imapUser.trim()}". Check: (1) Password is correct, (2) For Gmail use an App Password, (3) Account is not locked/disabled, (4) IMAP access is enabled in email provider settings.`
        } else if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
          diagnostic = `DNS lookup failed for "${imapHost.trim()}". Check the hostname is correct.`
        } else if (err.message.includes('ECONNREFUSED')) {
          diagnostic = `Connection refused at ${imapHost.trim()}:${port}. Check host and port, and ensure IMAP is enabled.`
        } else if (err.message.includes('ETIMEDOUT') || err.message.includes('timeout')) {
          diagnostic = `Connection timed out to ${imapHost.trim()}:${port}. Check host, port, and firewall settings.`
        } else if (err.message.includes('certificate') || err.message.includes('SSL') || err.message.includes('TLS')) {
          diagnostic = `TLS/SSL error: ${err.message}. Try port 143 (non-TLS) or check certificate settings.`
        }

        resolve({ success: false, error: diagnostic })
      })

      imap.connect()
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        messages: result.messages,
        recent: result.recent,
        unseen: result.unseen,
        logs,
      })
    } else {
      return NextResponse.json({ error: result.error, logs }, { status: 400 })
    }
  } catch (error: unknown) {
    console.error('Test IMAP error:', error)
    const err = error as { message?: string }
    return NextResponse.json({ error: err.message || 'Failed to test IMAP connection' }, { status: 500 })
  }
}
