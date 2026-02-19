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

    const result = await new Promise<{ success: boolean; messages?: number; recent?: number; unseen?: number; error?: string }>((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Connection timed out after 15 seconds' })
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
      })

      imap.once('ready', () => {
        imap.openBox(mailbox, true, (err: Error | null, box: Imap.Box) => {
          clearTimeout(timeout)
          if (err) {
            imap.end()
            resolve({ success: false, error: `Failed to open mailbox "${mailbox}": ${err.message}` })
            return
          }

          // Count unseen messages
          imap.search(['UNSEEN'], (searchErr: Error | null, uids: number[]) => {
            const unseen = searchErr ? 0 : (uids?.length || 0)
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
        resolve({ success: false, error: err.message })
      })

      imap.connect()
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        messages: result.messages,
        recent: result.recent,
        unseen: result.unseen,
      })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error: unknown) {
    console.error('Test IMAP error:', error)
    const err = error as { message?: string }
    return NextResponse.json({ error: err.message || 'Failed to test IMAP connection' }, { status: 500 })
  }
}
