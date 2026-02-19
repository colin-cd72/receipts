#!/usr/bin/env node
/**
 * Inbound SMTP server for receipt processing.
 * Accepts emails with receipt attachments, processes them through Claude AI,
 * and replies with results or fix links.
 *
 * Runs as a standalone PM2 process alongside the Next.js app.
 * Shares the same SQLite database.
 */

const { SMTPServer } = require('smtp-server')
const { simpleParser } = require('mailparser')
const Imap = require('imap')
const Database = require('better-sqlite3')
const Anthropic = require('@anthropic-ai/sdk').default
const nodemailer = require('nodemailer')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config()

// ── Logging ─────────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

function log(prefix, ...args) {
  console.log(`[${timestamp()}] [${prefix}]`, ...args)
}

// ── Database setup ──────────────────────────────────────────────────────────

const dbPath = path.join(process.cwd(), 'data', 'receipts.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

// ── Helpers ─────────────────────────────────────────────────────────────────

function getAllowedSenders() {
  const rows = db.prepare('SELECT email FROM allowed_senders').all()
  return rows.map(r => r.email.toLowerCase())
}

function getInboundEmailByMessageId(messageId) {
  return db.prepare('SELECT * FROM inbound_emails WHERE message_id = ?').get(messageId)
}

function insertInboundEmail(data) {
  const stmt = db.prepare(`
    INSERT INTO inbound_emails (message_id, from_address, from_name, to_address, subject, body_text, attachment_count)
    VALUES (@message_id, @from_address, @from_name, @to_address, @subject, @body_text, @attachment_count)
  `)
  return stmt.run({
    message_id: data.message_id || null,
    from_address: data.from_address,
    from_name: data.from_name || null,
    to_address: data.to_address || null,
    subject: data.subject || null,
    body_text: data.body_text || null,
    attachment_count: data.attachment_count || 0,
  }).lastInsertRowid
}

function updateInboundEmail(id, data) {
  const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
  db.prepare(`UPDATE inbound_emails SET ${fields} WHERE id = @id`).run({ ...data, id })
}

function insertReceipt(data) {
  const stmt = db.prepare(`
    INSERT INTO receipts (filename, original_filename, uploader_name, uploader_email, inbound_email_id)
    VALUES (@filename, @original_filename, @uploader_name, @uploader_email, @inbound_email_id)
  `)
  return stmt.run({
    filename: data.filename,
    original_filename: data.original_filename,
    uploader_name: data.uploader_name,
    uploader_email: data.uploader_email || null,
    inbound_email_id: data.inbound_email_id || null,
  }).lastInsertRowid
}

function updateReceipt(id, data) {
  const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
  db.prepare(`UPDATE receipts SET ${fields} WHERE id = @id`).run({ ...data, id })
}

function generateEditToken(id) {
  const token = crypto.randomUUID()
  db.prepare('UPDATE receipts SET edit_token = ? WHERE id = ?').run(token, id)
  return token
}

// ── Claude AI analysis ──────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'Meals & Entertainment', 'Travel - Airfare', 'Travel - Lodging',
  'Travel - Ground Transportation', 'Office Supplies', 'Equipment',
  'Software & Subscriptions', 'Professional Services', 'Training & Education',
  'Communication', 'Shipping & Postage', 'Other',
]

async function analyzeReceipt(filePath) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const absolutePath = path.join(process.cwd(), 'data', 'uploads', filePath)
  const ext = path.extname(filePath).toLowerCase()
  const fileData = fs.readFileSync(absolutePath)

  if (fileData.length > 15 * 1024 * 1024) {
    return { vendor: null, amount: null, currency: 'USD', date: null, category: null, description: null, payment_method: null, raw_text: 'File too large' }
  }

  const base64Data = fileData.toString('base64')
  let fileContent
  if (ext === '.pdf') {
    fileContent = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
  } else {
    let mediaType = 'image/jpeg'
    if (ext === '.png') mediaType = 'image/png'
    else if (ext === '.gif') mediaType = 'image/gif'
    else if (ext === '.webp') mediaType = 'image/webp'
    fileContent = { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } }
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const anthropic = new Anthropic({ apiKey })
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        fileContent,
        {
          type: 'text',
          text: `You are an expert receipt analyzer. Today's date is ${todayStr}. Analyze this receipt and extract information.

Return JSON with these fields:
{
  "vendor": "Name of the merchant",
  "amount": 123.45,
  "currency": "USD",
  "date": "YYYY-MM-DD",
  "category": "Category from list below",
  "description": "Brief description",
  "payment_method": "Card type or payment method",
  "raw_text": "Key text from receipt"
}

DATE RULES:
- Use transaction date, not print date
- If only MM/DD shown, assume ${currentYear} if month <= ${currentMonth}, else ${currentYear - 1}
- Output MUST be YYYY-MM-DD

AMOUNT: Extract TOTAL after tax. Return as number without currency symbols.
VENDOR: Use business name, cleaned up.

CATEGORIES: ${EXPENSE_CATEGORIES.join(', ')}

If a field cannot be determined, use null. Return ONLY the JSON object.`,
        },
      ],
    }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock) throw new Error('No text response from Claude')

  try {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const result = JSON.parse(jsonMatch[0])
    if (result.amount !== null && typeof result.amount !== 'number') {
      const parsed = parseFloat(String(result.amount).replace(/[$,]/g, ''))
      result.amount = isNaN(parsed) ? null : parsed
    }
    if (!result.currency) result.currency = 'USD'
    return result
  } catch {
    return { vendor: null, amount: null, currency: 'USD', date: null, category: null, description: null, payment_method: null, raw_text: textBlock.text }
  }
}

// ── Dropbox upload ──────────────────────────────────────────────────────────

let cachedAccessToken = null
let tokenExpiresAt = 0

async function getDropboxToken() {
  const staticToken = process.env.DROPBOX_ACCESS_TOKEN
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN
  const appKey = process.env.DROPBOX_APP_KEY
  const appSecret = process.env.DROPBOX_APP_SECRET

  if (!refreshToken || !appKey || !appSecret) return staticToken || null

  if (cachedAccessToken && tokenExpiresAt > Date.now() + 300000) return cachedAccessToken

  try {
    const res = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: appKey, client_secret: appSecret }),
    })
    if (!res.ok) return staticToken || null
    const data = await res.json()
    cachedAccessToken = data.access_token
    tokenExpiresAt = Date.now() + (data.expires_in * 1000)
    return cachedAccessToken
  } catch {
    return staticToken || null
  }
}

async function uploadToDropbox(filename, vendor, amount, date, originalFilename) {
  const token = await getDropboxToken()
  if (!token) return

  const localPath = path.join(process.cwd(), 'data', 'uploads', filename)
  if (!fs.existsSync(localPath)) return

  const ext = path.extname(originalFilename).toLowerCase()
  const safeVendor = (vendor || 'unknown').replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)
  const amountStr = amount ? amount.toFixed(2) : '0.00'
  const smartFilename = `${safeVendor}_$${amountStr}${ext}`
  const dateFolder = date || 'unknown-date'
  const basePath = (process.env.DROPBOX_FOLDER || '/TGL/Receipts').replace(/\/$/, '')
  const dropboxPath = `${basePath}/${dateFolder}/${smartFilename}`

  try {
    // Check if exists
    const metaRes = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dropboxPath }),
    })
    if (metaRes.ok) { console.log('Already in Dropbox:', dropboxPath); return }

    const fileBuffer = fs.readFileSync(localPath)
    const uploadRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'add', autorename: true }),
      },
      body: fileBuffer,
    })
    if (uploadRes.ok) console.log('Uploaded to Dropbox:', dropboxPath)
    else console.error('Dropbox upload failed:', await uploadRes.text())
  } catch (err) {
    console.error('Dropbox error:', err)
  }
}

// ── Email sending ───────────────────────────────────────────────────────────

function createTransporter() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
  })
}

async function sendReply(to, subject, messageId, html) {
  const transporter = createTransporter()
  const from = process.env.SMTP_FROM
  if (!transporter || !from) { console.log('SMTP not configured, skipping reply'); return false }

  try {
    const headers = {}
    if (messageId) {
      headers['In-Reply-To'] = messageId
      headers['References'] = messageId
    }
    await transporter.sendMail({
      from, to,
      subject: `Re: ${subject || 'Your Receipt'}`,
      headers,
      html,
    })
    return true
  } catch (err) {
    console.error('Reply send error:', err)
    return false
  }
}

function buildSuccessReplyHtml(results) {
  const siteUrl = process.env.SITE_URL || 'https://receipts.co-l.in'
  const rows = results.map(r => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${r.original_filename}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${r.vendor || 'Unknown'}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#059669;font-weight:600;">${r.amount ? `$${r.amount.toFixed(2)}` : '-'}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${r.date || '-'}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${r.category || '-'}</td>
    </tr>
  `).join('')

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1f2937;border-bottom:2px solid #22c55e;padding-bottom:10px;">Receipts Processed Successfully</h2>
      <p style="color:#4b5563;">Your receipt${results.length > 1 ? 's have' : ' has'} been processed:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead><tr style="background:#f9fafb;">
          <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">File</th>
          <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Vendor</th>
          <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Amount</th>
          <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Date</th>
          <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Category</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:20px;padding:15px;background:#f3f4f6;border-radius:8px;">
        <a href="${siteUrl}/admin" style="color:#3b82f6;text-decoration:none;font-weight:500;">View in Admin Dashboard &rarr;</a>
      </div>
      <p style="margin-top:30px;color:#9ca3af;font-size:12px;">Automated receipt processing by receipts.co-l.in</p>
    </div>
  `
}

function buildFixReplyHtml(results) {
  const siteUrl = process.env.SITE_URL || 'https://receipts.co-l.in'
  const items = results.map(r => {
    const missing = []
    if (!r.vendor) missing.push('Vendor')
    if (!r.amount) missing.push('Amount')
    if (!r.date || r.date < '2025-10-01') missing.push('Date')
    return `
      <div style="margin:15px 0;padding:15px;background:#fef3c7;border-radius:8px;border-left:4px solid #f59e0b;">
        <p style="margin:0 0 8px;font-weight:600;">${r.original_filename}</p>
        <p style="margin:0 0 8px;color:#92400e;font-size:14px;">Missing: ${missing.join(', ')}</p>
        <a href="${siteUrl}/fix/${r.token}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;">Fix This Receipt</a>
      </div>
    `
  }).join('')

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1f2937;border-bottom:2px solid #f59e0b;padding-bottom:10px;">Receipt${results.length > 1 ? 's Need' : ' Needs'} Attention</h2>
      <p style="color:#4b5563;">We couldn't extract all information from your receipt${results.length > 1 ? 's' : ''}. Please help by filling in the missing details:</p>
      ${items}
      <p style="margin-top:30px;color:#9ca3af;font-size:12px;">These links are unique. Please don't share them.</p>
    </div>
  `
}

function buildNoAttachmentReplyHtml() {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1f2937;border-bottom:2px solid #ef4444;padding-bottom:10px;">No Attachments Found</h2>
      <p style="color:#4b5563;">We didn't find any receipt images or PDFs attached to your email.</p>
      <p style="color:#4b5563;">Please reply with your receipt attached as:</p>
      <ul style="color:#4b5563;">
        <li>Image files (JPEG, PNG, GIF, WebP)</li>
        <li>PDF documents</li>
      </ul>
      <p style="margin-top:30px;color:#9ca3af;font-size:12px;">Automated receipt processing by receipts.co-l.in</p>
    </div>
  `
}

// ── Main email processing ───────────────────────────────────────────────────

const VALID_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

function getExtFromMime(contentType) {
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
    'image/webp': '.webp', 'application/pdf': '.pdf',
  }
  return map[contentType] || '.bin'
}

async function processEmail(parsed) {
  const messageId = parsed.messageId || null
  const fromAddr = parsed.from?.value?.[0]?.address || 'unknown'
  const fromName = parsed.from?.value?.[0]?.name || fromAddr.split('@')[0]
  const toAddr = parsed.to?.value?.[0]?.address || 'receipts@co-l.in'
  const subject = parsed.subject || '(no subject)'
  const bodyText = parsed.text || ''

  log('EMAIL', `Processing from ${fromAddr}: "${subject}" (${(parsed.attachments || []).length} attachments)`)

  // Dedup by message ID
  if (messageId) {
    const existing = getInboundEmailByMessageId(messageId)
    if (existing) {
      log('EMAIL', `Duplicate (message_id already seen), skipping: ${messageId}`)
      return
    }
  }

  // Filter valid attachments
  const attachments = (parsed.attachments || []).filter(att => {
    const ct = (att.contentType || '').toLowerCase()
    return VALID_MIME_PREFIXES.some(prefix => ct.startsWith(prefix))
  })

  // Insert inbound email record
  const emailId = insertInboundEmail({
    message_id: messageId,
    from_address: fromAddr,
    from_name: fromName,
    to_address: toAddr,
    subject,
    body_text: bodyText.substring(0, 10000),
    attachment_count: attachments.length,
  })

  // No attachments case
  if (attachments.length === 0) {
    updateInboundEmail(emailId, { status: 'no_attachments', processed_at: new Date().toISOString() })
    const sent = await sendReply(fromAddr, subject, messageId, buildNoAttachmentReplyHtml())
    if (sent) updateInboundEmail(emailId, { reply_sent: 1 })
    return
  }

  // Process each attachment
  updateInboundEmail(emailId, { status: 'processing' })
  const successResults = []
  const fixResults = []

  for (const attachment of attachments) {
    try {
      const ct = attachment.contentType.toLowerCase()
      const ext = getExtFromMime(ct)
      const uniqueFilename = `${crypto.randomUUID()}${ext}`
      const uploadDir = path.join(process.cwd(), 'data', 'uploads')
      fs.mkdirSync(uploadDir, { recursive: true })
      fs.writeFileSync(path.join(uploadDir, uniqueFilename), attachment.content)

      const originalFilename = attachment.filename || `receipt${ext}`

      // Insert receipt record
      const receiptId = insertReceipt({
        filename: uniqueFilename,
        original_filename: originalFilename,
        uploader_name: fromName,
        uploader_email: fromAddr,
        inbound_email_id: emailId,
      })

      // Analyze with Claude
      updateReceipt(receiptId, { status: 'processing' })
      const analysis = await analyzeReceipt(uniqueFilename)

      updateReceipt(receiptId, {
        vendor: analysis.vendor || undefined,
        amount: analysis.amount || undefined,
        currency: analysis.currency || 'USD',
        date: analysis.date || undefined,
        category: analysis.category || undefined,
        description: analysis.description || undefined,
        payment_method: analysis.payment_method || undefined,
        raw_text: analysis.raw_text || undefined,
        status: 'processed',
        processed_at: new Date().toISOString(),
      })

      // Upload to Dropbox
      await uploadToDropbox(uniqueFilename, analysis.vendor, analysis.amount, analysis.date, originalFilename)

      // Check if data is complete
      const needsFix = !analysis.vendor || !analysis.amount || !analysis.date || (analysis.date && analysis.date < '2025-10-01')

      if (needsFix) {
        const token = generateEditToken(receiptId)
        fixResults.push({ original_filename: originalFilename, vendor: analysis.vendor, amount: analysis.amount, date: analysis.date, token })
      } else {
        successResults.push({ original_filename: originalFilename, vendor: analysis.vendor, amount: analysis.amount, date: analysis.date, category: analysis.category })
      }

      log('EMAIL', `  Processed: ${originalFilename} -> vendor=${analysis.vendor}, amount=${analysis.amount}, date=${analysis.date}`)
    } catch (err) {
      log('EMAIL', `  Attachment error: ${err.message || err}`)
    }
  }

  // Send reply
  let replySent = false
  if (fixResults.length > 0 && successResults.length > 0) {
    // Mixed: some success, some need fixing
    const html = buildSuccessReplyHtml(successResults) + '<hr style="margin:30px 0;border:none;border-top:1px solid #e5e7eb;">' + buildFixReplyHtml(fixResults)
    replySent = await sendReply(fromAddr, subject, messageId, html)
  } else if (fixResults.length > 0) {
    replySent = await sendReply(fromAddr, subject, messageId, buildFixReplyHtml(fixResults))
  } else if (successResults.length > 0) {
    replySent = await sendReply(fromAddr, subject, messageId, buildSuccessReplyHtml(successResults))
  }

  updateInboundEmail(emailId, {
    status: 'processed',
    processed_at: new Date().toISOString(),
    reply_sent: replySent ? 1 : 0,
  })

  log('EMAIL', `Complete: ${successResults.length} success, ${fixResults.length} need fix, reply ${replySent ? 'sent' : 'not sent'}`)
}

// ── SMTP Server ─────────────────────────────────────────────────────────────

const server = new SMTPServer({
  secure: false,
  authOptional: true,
  disabledCommands: ['AUTH'],
  banner: 'Receipt Upload SMTP Server',
  size: 25 * 1024 * 1024, // 25MB max

  onRcptTo(address, session, callback) {
    const recipient = address.address.toLowerCase()
    // Only accept emails to receipts@co-l.in
    if (!recipient.startsWith('receipts@')) {
      return callback(new Error('Recipient not accepted'))
    }
    callback()
  },

  onMailFrom(address, session, callback) {
    const sender = address.address.toLowerCase()
    const allowed = getAllowedSenders()
    if (allowed.length === 0) {
      log('SMTP', 'No allowed senders configured - rejecting all')
      return callback(new Error('Sender not authorized - no allowed senders configured'))
    }
    if (!allowed.includes(sender)) {
      log('SMTP', `Rejected unauthorized sender: ${sender}`)
      return callback(new Error('Sender not authorized'))
    }
    callback()
  },

  onData(stream, session, callback) {
    const chunks = []
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('end', async () => {
      try {
        const raw = Buffer.concat(chunks)
        const parsed = await simpleParser(raw)
        // Process asynchronously so we don't block the SMTP connection
        processEmail(parsed).catch(err => {
          console.error('Email processing error:', err)
        })
        callback()
      } catch (err) {
        console.error('Parse error:', err)
        callback(err)
      }
    })
  },
})

const PORT = parseInt(process.env.SMTP_LISTEN_PORT || '25', 10)

server.listen(PORT, () => {
  log('SMTP', `Listening on port ${PORT}`)
  log('SMTP', 'Accepting emails to receipts@co-l.in')
  const allowed = getAllowedSenders()
  if (allowed.length === 0) {
    log('SMTP', 'WARNING: No allowed senders configured. All emails will be rejected.')
  } else {
    log('SMTP', `Allowed senders (${allowed.length}): ${allowed.join(', ')}`)
  }
})

server.on('error', err => {
  log('SMTP', `ERROR: ${err.message}`)
})

// ── IMAP Polling ────────────────────────────────────────────────────────────

function reloadImapConfig() {
  // Re-read .env for latest IMAP settings (they may change via admin UI)
  try {
    const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf-8')
    const env = {}
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key) env[key.trim()] = valueParts.join('=').trim()
      }
    }
    return {
      host: env.IMAP_HOST || process.env.IMAP_HOST || '',
      port: parseInt(env.IMAP_PORT || process.env.IMAP_PORT || '993', 10),
      user: env.IMAP_USER || process.env.IMAP_USER || '',
      pass: env.IMAP_PASS || process.env.IMAP_PASS || '',
      mailbox: env.IMAP_MAILBOX || process.env.IMAP_MAILBOX || 'INBOX',
      pollInterval: Math.max(30, parseInt(env.IMAP_POLL_INTERVAL || process.env.IMAP_POLL_INTERVAL || '60', 10)),
    }
  } catch {
    return { host: '', port: 993, user: '', pass: '', mailbox: 'INBOX', pollInterval: 60 }
  }
}

let imapPolling = false

function pollImap() {
  if (imapPolling) return
  const config = reloadImapConfig()

  if (!config.host || !config.user || !config.pass) {
    return // IMAP not configured
  }

  imapPolling = true
  const pollStart = Date.now()
  log('IMAP', `Connecting to ${config.user}@${config.host}:${config.port} (TLS: ${config.port === 993}) mailbox: ${config.mailbox}`)

  const imap = new Imap({
    user: config.user,
    password: config.pass,
    host: config.host,
    port: config.port,
    tls: config.port === 993,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 15000,
    authTimeout: 15000,
  })

  imap.once('ready', () => {
    log('IMAP', `Connected in ${Date.now() - pollStart}ms`)
    imap.openBox(config.mailbox, false, (err, box) => {
      if (err) {
        log('IMAP', `ERROR opening mailbox "${config.mailbox}": ${err.message}`)
        imap.end()
        imapPolling = false
        return
      }

      log('IMAP', `Mailbox opened: ${box.messages.total} total, ${box.messages.new} recent`)

      // Search for unseen messages
      imap.search(['UNSEEN'], (err, uids) => {
        if (err) {
          log('IMAP', `ERROR searching: ${err.message}`)
          imap.end()
          imapPolling = false
          return
        }

        if (!uids || uids.length === 0) {
          log('IMAP', `No unseen messages (poll took ${Date.now() - pollStart}ms)`)
          imap.end()
          imapPolling = false
          return
        }

        log('IMAP', `Found ${uids.length} unseen message(s), fetching...`)
        let processed = 0
        let succeeded = 0
        let skipped = 0

        const fetch = imap.fetch(uids, { bodies: '', markSeen: true })

        fetch.on('message', (msg, seqno) => {
          const chunks = []

          msg.on('body', (stream) => {
            stream.on('data', chunk => chunks.push(chunk))
          })

          msg.on('end', async () => {
            try {
              const raw = Buffer.concat(chunks)
              const parsed = await simpleParser(raw)
              const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase() || ''
              const subject = parsed.subject || '(no subject)'

              log('IMAP', `  Message #${seqno}: from=${fromAddr} subject="${subject}" attachments=${(parsed.attachments || []).length}`)

              // Check sender allowlist
              const allowed = getAllowedSenders()
              if (allowed.length === 0) {
                log('IMAP', `  REJECTED: No allowed senders configured`)
                skipped++
              } else if (!allowed.includes(fromAddr)) {
                log('IMAP', `  REJECTED: Sender not in allowlist: ${fromAddr}`)
                skipped++
              } else {
                await processEmail(parsed)
                succeeded++
              }
            } catch (err) {
              log('IMAP', `  ERROR processing message #${seqno}: ${err.message || err}`)
            }

            processed++
            if (processed === uids.length) {
              log('IMAP', `Poll complete: ${succeeded} processed, ${skipped} skipped, ${processed - succeeded - skipped} errors (${Date.now() - pollStart}ms)`)
              imap.end()
              imapPolling = false
            }
          })
        })

        fetch.once('error', (err) => {
          log('IMAP', `ERROR fetching: ${err.message}`)
          imap.end()
          imapPolling = false
        })

        fetch.once('end', () => {
          // Wait for all message 'end' events before closing
          if (processed === uids.length) {
            imap.end()
            imapPolling = false
          }
        })
      })
    })
  })

  imap.once('error', (err) => {
    log('IMAP', `CONNECTION ERROR: ${err.message}`)
    imapPolling = false
  })

  imap.once('end', () => {
    imapPolling = false
  })

  imap.connect()
}

// Start IMAP polling loop
function startImapPolling() {
  const config = reloadImapConfig()
  if (config.host && config.user && config.pass) {
    log('IMAP', `Polling enabled: ${config.user}@${config.host}:${config.port} every ${config.pollInterval}s, mailbox: ${config.mailbox}`)
    // Initial poll after 5 seconds
    setTimeout(pollImap, 5000)
  } else {
    log('IMAP', 'Not configured - polling disabled. Configure in admin settings.')
  }

  // Poll on interval (re-reads config each time, so changes are picked up)
  setInterval(() => {
    const cfg = reloadImapConfig()
    if (cfg.host && cfg.user && cfg.pass) {
      pollImap()
    }
  }, (config.pollInterval || 60) * 1000)
}

startImapPolling()
