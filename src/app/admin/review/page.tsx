'use client'

import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Save,
  Loader2,
  CheckCircle,
  ArrowLeft,
  FileImage,
  Calendar,
  Mail,
  Send,
} from 'lucide-react'
import Link from 'next/link'

interface Receipt {
  id: number
  filename: string
  original_filename: string
  vendor: string | null
  amount: number | null
  date: string | null
  category: string | null
  uploader_name: string
  uploader_email: string | null
  fix_email_sent: number
  fix_email_opened_at: string | null
  fix_completed_at: string | null
  created_at: string
}

export default function ReviewPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState<number | null>(null)
  const [dates, setDates] = useState<Record<number, string>>({})
  const [saved, setSaved] = useState<Set<number>>(new Set())
  const [sendingEmails, setSendingEmails] = useState(false)
  const [emailResult, setEmailResult] = useState<{ sent: number; total: number } | null>(null)

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (auth === 'true') {
      setAuthenticated(true)
      fetchReceipts()
    } else {
      setLoading(false)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      sessionStorage.setItem('admin_auth', 'true')
      setAuthenticated(true)
      fetchReceipts()
    } else {
      alert('Invalid password')
    }
  }

  const fetchReceipts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/receipts/review')
      const data = await res.json()
      setReceipts(data.receipts || [])
      // Initialize dates state
      const initialDates: Record<number, string> = {}
      data.receipts?.forEach((r: Receipt) => {
        initialDates[r.id] = r.date || ''
      })
      setDates(initialDates)
    } catch (error) {
      console.error('Failed to fetch receipts:', error)
    }
    setLoading(false)
  }

  const handleSaveDate = async (id: number) => {
    const newDate = dates[id]
    if (!newDate) {
      alert('Please enter a valid date')
      return
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      alert('Date must be in YYYY-MM-DD format')
      return
    }

    setSaving(id)
    try {
      const res = await fetch(`/api/receipts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate }),
      })

      if (res.ok) {
        setSaved((prev) => new Set(prev).add(id))
        // Update local state
        setReceipts((prev) =>
          prev.map((r) => (r.id === id ? { ...r, date: newDate } : r))
        )
      } else {
        alert('Failed to save date')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save date')
    }
    setSaving(null)
  }

  const handleSendFixEmails = async () => {
    if (!confirm('Send fix request emails to all uploaders with incomplete receipts?')) return

    setSendingEmails(true)
    setEmailResult(null)
    try {
      const res = await fetch('/api/receipts/notify', { method: 'POST' })
      const data = await res.json()
      setEmailResult({ sent: data.sent || 0, total: data.total || 0 })
      fetchReceipts() // Refresh to update email sent status
    } catch (error) {
      console.error('Failed to send emails:', error)
      alert('Failed to send emails')
    }
    setSendingEmails(false)
  }

  const getMissingFields = (receipt: Receipt): string[] => {
    const missing: string[] = []
    if (!receipt.vendor) missing.push('Vendor')
    if (!receipt.amount) missing.push('Amount')
    if (!receipt.date || receipt.date < '2025-10-01') missing.push('Date')
    return missing
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-sm border max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-6">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full px-4 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  const receiptsWithEmail = receipts.filter(r => r.uploader_email && !r.fix_email_sent)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Admin
          </Link>
          {receiptsWithEmail.length > 0 && (
            <button
              onClick={handleSendFixEmails}
              disabled={sendingEmails}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
            >
              {sendingEmails ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Fix Emails ({receiptsWithEmail.length})
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Receipts for Review</h1>
            <p className="text-gray-500">
              These receipts have missing vendor, amount, or invalid dates
            </p>
          </div>
        </div>

        {/* Email Result */}
        {emailResult && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <Mail className="w-5 h-5 text-green-600" />
            <span className="text-green-800">
              Sent {emailResult.sent} of {emailResult.total} fix request emails
            </span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <p className="text-gray-600 font-medium">All receipts are complete!</p>
            <p className="text-gray-400 text-sm mt-1">No receipts need review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {receipts.map((receipt) => {
              const missingFields = getMissingFields(receipt)
              return (
                <div
                  key={receipt.id}
                  className={`bg-white rounded-xl border p-4 ${
                    saved.has(receipt.id) ? 'border-green-300 bg-green-50' : ''
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <a
                      href={`/api/receipts/${receipt.id}/image`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 w-32 h-40 bg-gray-100 rounded-lg overflow-hidden"
                    >
                      {receipt.original_filename.toLowerCase().endsWith('.pdf') ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <div className="text-center">
                            <FileImage className="w-8 h-8 mx-auto mb-1" />
                            <p className="text-xs">PDF</p>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={`/api/receipts/${receipt.id}/image`}
                          alt={receipt.original_filename}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </a>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {receipt.vendor || <span className="text-red-500">Unknown Vendor</span>}
                          </h3>
                          <p className={`font-bold ${receipt.amount ? 'text-green-600' : 'text-red-500'}`}>
                            {receipt.amount ? `$${receipt.amount.toFixed(2)}` : 'No amount'}
                          </p>
                          <p className="text-sm text-gray-500">{receipt.category || 'Uncategorized'}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-gray-400">ID: {receipt.id}</p>
                          <p className="text-gray-600">{receipt.uploader_name}</p>
                          {receipt.uploader_email && (
                            <p className="text-gray-400 text-xs">{receipt.uploader_email}</p>
                          )}
                        </div>
                      </div>

                      {/* Missing Fields Warning */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {missingFields.map((field) => (
                          <span
                            key={field}
                            className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full"
                          >
                            Missing: {field}
                          </span>
                        ))}
                        {receipt.fix_completed_at ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Fixed by user
                          </span>
                        ) : receipt.fix_email_opened_at ? (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Email Opened
                          </span>
                        ) : receipt.fix_email_sent ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Email Sent
                          </span>
                        ) : receipt.uploader_email ? (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            Email pending
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                            No email
                          </span>
                        )}
                      </div>

                      {/* Date Input */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            Current: {receipt.date || 'None'}
                          </span>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="date"
                            value={dates[receipt.id] || ''}
                            onChange={(e) =>
                              setDates((prev) => ({ ...prev, [receipt.id]: e.target.value }))
                            }
                            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            min="2025-10-01"
                          />
                          <button
                            onClick={() => handleSaveDate(receipt.id)}
                            disabled={saving === receipt.id || saved.has(receipt.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                              saved.has(receipt.id)
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            } disabled:opacity-50`}
                          >
                            {saving === receipt.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : saved.has(receipt.id) ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            {saved.has(receipt.id) ? 'Saved' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
