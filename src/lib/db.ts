import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data', 'receipts.db')
const db = new Database(dbPath)

// Initialize database schema
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
    processed_at DATETIME
  )
`)

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

export default db
