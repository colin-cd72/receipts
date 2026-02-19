import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data', 'receipts.db')
const db = new Database(dbPath)

// Enable WAL mode for concurrent access (SMTP server + Next.js)
db.pragma('journal_mode = WAL')

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS inbound_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT,
    from_address TEXT NOT NULL,
    from_name TEXT,
    to_address TEXT,
    subject TEXT,
    body_text TEXT,
    attachment_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'received',
    error_message TEXT,
    reply_sent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    uploader_name TEXT NOT NULL,
    uploader_email TEXT,
    vendor TEXT,
    amount REAL,
    currency TEXT DEFAULT 'USD',
    date TEXT,
    category TEXT,
    description TEXT,
    payment_method TEXT,
    status TEXT DEFAULT 'pending',
    raw_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    edit_token TEXT,
    fix_email_sent INTEGER DEFAULT 0
  )
`)

// Add columns if they don't exist (for existing databases)
try {
  db.exec(`ALTER TABLE receipts ADD COLUMN edit_token TEXT`)
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE receipts ADD COLUMN fix_email_sent INTEGER DEFAULT 0`)
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE receipts ADD COLUMN fix_email_opened_at TEXT`)
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE receipts ADD COLUMN fix_completed_at TEXT`)
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE receipts ADD COLUMN inbound_email_id INTEGER`)
} catch { /* column already exists */ }

export interface Receipt {
  id: number
  filename: string
  original_filename: string
  uploader_name: string
  uploader_email: string | null
  vendor: string | null
  amount: number | null
  currency: string
  date: string | null
  category: string | null
  description: string | null
  payment_method: string | null
  status: string
  raw_text: string | null
  created_at: string
  processed_at: string | null
  edit_token: string | null
  fix_email_sent: number
  fix_email_opened_at: string | null
  fix_completed_at: string | null
  inbound_email_id: number | null
}

export interface ReceiptInsert {
  filename: string
  original_filename: string
  uploader_name: string
  uploader_email?: string
}

export interface ReceiptUpdate {
  vendor?: string
  amount?: number
  currency?: string
  date?: string
  category?: string
  description?: string
  payment_method?: string
  status?: string
  raw_text?: string
  processed_at?: string
}

export function insertReceipt(data: ReceiptInsert): number {
  const stmt = db.prepare(`
    INSERT INTO receipts (filename, original_filename, uploader_name, uploader_email)
    VALUES (@filename, @original_filename, @uploader_name, @uploader_email)
  `)
  const result = stmt.run({
    ...data,
    uploader_email: data.uploader_email || null,
  })
  return result.lastInsertRowid as number
}

export function updateReceipt(id: number, data: ReceiptUpdate): void {
  const fields = Object.keys(data)
    .map((key) => `${key} = @${key}`)
    .join(', ')
  const stmt = db.prepare(`UPDATE receipts SET ${fields} WHERE id = @id`)
  stmt.run({ ...data, id })
}

export function getReceipt(id: number): Receipt | undefined {
  const stmt = db.prepare('SELECT * FROM receipts WHERE id = ?')
  return stmt.get(id) as Receipt | undefined
}

export function getAllReceipts(): Receipt[] {
  const stmt = db.prepare('SELECT * FROM receipts ORDER BY created_at DESC')
  return stmt.all() as Receipt[]
}

export function getReceiptsByStatus(status: string): Receipt[] {
  const stmt = db.prepare('SELECT * FROM receipts WHERE status = ? ORDER BY created_at DESC')
  return stmt.all(status) as Receipt[]
}

export function deleteReceipt(id: number): void {
  const stmt = db.prepare('DELETE FROM receipts WHERE id = ?')
  stmt.run(id)
}

export function getReceiptsForReview(): Receipt[] {
  const stmt = db.prepare(`
    SELECT * FROM receipts
    WHERE (date IS NULL OR date < '2025-10-01' OR vendor IS NULL OR amount IS NULL)
      AND status = 'processed'
    ORDER BY created_at DESC
  `)
  return stmt.all() as Receipt[]
}

export function generateEditToken(id: number): string {
  const token = crypto.randomUUID()
  const stmt = db.prepare('UPDATE receipts SET edit_token = ? WHERE id = ?')
  stmt.run(token, id)
  return token
}

export function getReceiptByToken(token: string): Receipt | undefined {
  const stmt = db.prepare('SELECT * FROM receipts WHERE edit_token = ?')
  return stmt.get(token) as Receipt | undefined
}

export function markFixEmailSent(id: number): void {
  const stmt = db.prepare('UPDATE receipts SET fix_email_sent = 1 WHERE id = ?')
  stmt.run(id)
}

export function markFixEmailOpened(token: string): void {
  const stmt = db.prepare(`
    UPDATE receipts
    SET fix_email_opened_at = COALESCE(fix_email_opened_at, ?)
    WHERE edit_token = ?
  `)
  stmt.run(new Date().toISOString(), token)
}

export function markFixCompleted(id: number): void {
  const stmt = db.prepare('UPDATE receipts SET fix_completed_at = ? WHERE id = ?')
  stmt.run(new Date().toISOString(), id)
}

export function getReceiptsNeedingFixEmail(): Receipt[] {
  const stmt = db.prepare(`
    SELECT * FROM receipts
    WHERE status = 'processed'
      AND fix_email_sent = 0
      AND uploader_email IS NOT NULL
      AND uploader_email != ''
      AND (vendor IS NULL OR amount IS NULL OR date IS NULL OR date < '2025-10-01')
    ORDER BY created_at DESC
  `)
  return stmt.all() as Receipt[]
}

// Inbound email types and CRUD

export interface InboundEmail {
  id: number
  message_id: string | null
  from_address: string
  from_name: string | null
  to_address: string | null
  subject: string | null
  body_text: string | null
  attachment_count: number
  status: string
  error_message: string | null
  reply_sent: number
  created_at: string
  processed_at: string | null
}

export interface InboundEmailInsert {
  message_id?: string
  from_address: string
  from_name?: string
  to_address?: string
  subject?: string
  body_text?: string
  attachment_count?: number
}

export function insertInboundEmail(data: InboundEmailInsert): number {
  const stmt = db.prepare(`
    INSERT INTO inbound_emails (message_id, from_address, from_name, to_address, subject, body_text, attachment_count)
    VALUES (@message_id, @from_address, @from_name, @to_address, @subject, @body_text, @attachment_count)
  `)
  const result = stmt.run({
    message_id: data.message_id || null,
    from_address: data.from_address,
    from_name: data.from_name || null,
    to_address: data.to_address || null,
    subject: data.subject || null,
    body_text: data.body_text || null,
    attachment_count: data.attachment_count || 0,
  })
  return result.lastInsertRowid as number
}

export function updateInboundEmail(id: number, data: Partial<Pick<InboundEmail, 'status' | 'error_message' | 'reply_sent' | 'processed_at' | 'attachment_count'>>): void {
  const fields = Object.keys(data)
    .map((key) => `${key} = @${key}`)
    .join(', ')
  const stmt = db.prepare(`UPDATE inbound_emails SET ${fields} WHERE id = @id`)
  stmt.run({ ...data, id })
}

export function getInboundEmail(id: number): InboundEmail | undefined {
  const stmt = db.prepare('SELECT * FROM inbound_emails WHERE id = ?')
  return stmt.get(id) as InboundEmail | undefined
}

export function getInboundEmailByMessageId(messageId: string): InboundEmail | undefined {
  const stmt = db.prepare('SELECT * FROM inbound_emails WHERE message_id = ?')
  return stmt.get(messageId) as InboundEmail | undefined
}

export function getAllInboundEmails(): InboundEmail[] {
  const stmt = db.prepare('SELECT * FROM inbound_emails ORDER BY created_at DESC')
  return stmt.all() as InboundEmail[]
}

export function deleteInboundEmail(id: number): void {
  const stmt = db.prepare('DELETE FROM inbound_emails WHERE id = ?')
  stmt.run(id)
}

export function getReceiptsByInboundEmailId(inboundEmailId: number): Receipt[] {
  const stmt = db.prepare('SELECT * FROM receipts WHERE inbound_email_id = ? ORDER BY created_at DESC')
  return stmt.all(inboundEmailId) as Receipt[]
}

// Allowed senders CRUD

db.exec(`
  CREATE TABLE IF NOT EXISTS allowed_senders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

export interface AllowedSender {
  id: number
  email: string
  name: string | null
  created_at: string
}

export function getAllAllowedSenders(): AllowedSender[] {
  const stmt = db.prepare('SELECT * FROM allowed_senders ORDER BY email ASC')
  return stmt.all() as AllowedSender[]
}

export function addAllowedSender(email: string, name?: string): number {
  const stmt = db.prepare('INSERT OR IGNORE INTO allowed_senders (email, name) VALUES (?, ?)')
  const result = stmt.run(email.toLowerCase().trim(), name || null)
  return result.lastInsertRowid as number
}

export function removeAllowedSender(id: number): void {
  const stmt = db.prepare('DELETE FROM allowed_senders WHERE id = ?')
  stmt.run(id)
}

export function isAllowedSender(email: string): boolean {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM allowed_senders')
  const { count } = stmt.get() as { count: number }
  // If no senders configured, reject all (fail-closed)
  if (count === 0) return false
  const check = db.prepare('SELECT 1 FROM allowed_senders WHERE email = ?')
  return !!check.get(email.toLowerCase().trim())
}

export default db
