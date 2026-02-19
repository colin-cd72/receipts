'use client'

import { useState, useEffect } from 'react'
import {
  Mail,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  ArrowLeft,
  RotateCcw,
  Paperclip,
  Send,
  XCircle,
  UserPlus,
  X,
  Shield,
} from 'lucide-react'
import Link from 'next/link'

interface Receipt {
  id: number
  filename: string
  original_filename: string
  vendor: string | null
  amount: number | null
  date: string | null
  status: string
}

interface InboundEmail {
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
  receipts: Receipt[]
}

interface AllowedSender {
  id: number
  email: string
  name: string | null
  created_at: string
}

export default function InboxPage() {
  const [emails, setEmails] = useState<InboundEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [reprocessingId, setReprocessingId] = useState<number | null>(null)

  // Allowed senders state
  const [senders, setSenders] = useState<AllowedSender[]>([])
  const [showSenders, setShowSenders] = useState(false)
  const [newSenderEmail, setNewSenderEmail] = useState('')
  const [newSenderName, setNewSenderName] = useState('')
  const [addingSender, setAddingSender] = useState(false)

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (auth === 'true') {
      setAuthenticated(true)
      fetchEmails()
      fetchSenders()
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
      fetchEmails()
      fetchSenders()
    } else {
      alert('Invalid password')
    }
  }

  const fetchEmails = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inbox')
      const data = await res.json()
      setEmails(data.emails || [])
    } catch (error) {
      console.error('Failed to fetch inbox:', error)
    }
    setLoading(false)
  }

  const fetchSenders = async () => {
    try {
      const res = await fetch('/api/inbox/senders')
      const data = await res.json()
      setSenders(data.senders || [])
    } catch (error) {
      console.error('Failed to fetch senders:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this email and all linked receipts?')) return
    try {
      await fetch(`/api/inbox/${id}`, { method: 'DELETE' })
      setEmails((prev) => prev.filter((e) => e.id !== id))
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleReprocess = async (id: number) => {
    setReprocessingId(id)
    try {
      await fetch(`/api/inbox/${id}/reprocess`, { method: 'POST' })
      await fetchEmails()
    } catch (error) {
      console.error('Failed to reprocess:', error)
    }
    setReprocessingId(null)
  }

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSenderEmail) return
    setAddingSender(true)
    try {
      await fetch('/api/inbox/senders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newSenderEmail, name: newSenderName || undefined }),
      })
      setNewSenderEmail('')
      setNewSenderName('')
      await fetchSenders()
    } catch (error) {
      console.error('Failed to add sender:', error)
    }
    setAddingSender(false)
  }

  const handleRemoveSender = async (id: number) => {
    try {
      await fetch('/api/inbox/senders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setSenders((prev) => prev.filter((s) => s.id !== id))
    } catch (error) {
      console.error('Failed to remove sender:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'no_attachments':
        return <XCircle className="w-4 h-4 text-gray-400" />
      default:
        return <Clock className="w-4 h-4 text-blue-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      received: 'bg-blue-100 text-blue-700',
      processing: 'bg-yellow-100 text-yellow-700',
      processed: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700',
      no_attachments: 'bg-gray-100 text-gray-600',
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {getStatusIcon(status)}
        {status.replace('_', ' ')}
      </span>
    )
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
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
              Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 hover:bg-gray-200 rounded-lg transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Email Inbox</h1>
              <p className="text-sm text-gray-500">Inbound receipt emails to receipts@co-l.in</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSenders(!showSenders)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition ${
                showSenders ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <Shield className="w-4 h-4" />
              Allowed Senders ({senders.length})
            </button>
            <button
              onClick={fetchEmails}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Allowed Senders Panel */}
        {showSenders && (
          <div className="bg-white rounded-xl border mb-8 overflow-hidden">
            <div className="bg-indigo-50 border-b px-6 py-4">
              <h2 className="font-semibold text-indigo-900 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Allowed Senders
              </h2>
              <p className="text-sm text-indigo-700 mt-1">
                Only emails from these addresses will be accepted. If no senders are configured, all emails are rejected.
              </p>
            </div>
            <div className="p-6">
              {/* Add sender form */}
              <form onSubmit={handleAddSender} className="flex gap-3 mb-4">
                <input
                  type="email"
                  value={newSenderEmail}
                  onChange={(e) => setNewSenderEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
                <input
                  type="text"
                  value={newSenderName}
                  onChange={(e) => setNewSenderName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-48 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={addingSender}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {addingSender ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Add
                </button>
              </form>

              {/* Sender list */}
              {senders.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Shield className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No allowed senders configured. All inbound emails will be rejected.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {senders.map((sender) => (
                    <div key={sender.id} className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{sender.email}</span>
                        {sender.name && <span className="text-gray-500 ml-2">({sender.name})</span>}
                      </div>
                      <button
                        onClick={() => handleRemoveSender(sender.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        title="Remove sender"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500">Total Emails</p>
            <p className="text-2xl font-bold">{emails.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500">Processed</p>
            <p className="text-2xl font-bold text-green-600">
              {emails.filter((e) => e.status === 'processed').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500">Processing</p>
            <p className="text-2xl font-bold text-yellow-600">
              {emails.filter((e) => e.status === 'processing' || e.status === 'received').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500">Errors</p>
            <p className="text-2xl font-bold text-red-600">
              {emails.filter((e) => e.status === 'error').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500">No Attachments</p>
            <p className="text-2xl font-bold text-gray-400">
              {emails.filter((e) => e.status === 'no_attachments').length}
            </p>
          </div>
        </div>

        {/* Email List */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <Mail className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No inbound emails received yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Forward receipts to receipts@co-l.in
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">From</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Subject</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Attachments</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Reply</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email) => (
                  <>
                    <tr
                      key={email.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                    >
                      <td className="px-4 py-3">{getStatusBadge(email.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(email.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <span className="font-medium">{email.from_name || email.from_address}</span>
                          {email.from_name && (
                            <span className="text-gray-400 block text-xs">{email.from_address}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm max-w-xs truncate">{email.subject || '(no subject)'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="flex items-center gap-1">
                          <Paperclip className="w-3 h-3 text-gray-400" />
                          {email.attachment_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {email.reply_sent ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <Send className="w-3 h-3" /> Sent
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {(email.status === 'error' || email.status === 'received') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReprocess(email.id) }}
                              disabled={reprocessingId === email.id}
                              className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"
                              title="Reprocess"
                            >
                              {reprocessingId === email.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(email.id) }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {expandedId === email.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === email.id && (
                      <tr key={`${email.id}-details`} className="bg-gray-50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-4">
                            {/* Email body preview */}
                            {email.body_text && (
                              <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">Email Body</p>
                                <pre className="p-3 bg-white border rounded-lg text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                                  {email.body_text}
                                </pre>
                              </div>
                            )}

                            {/* Error message */}
                            {email.error_message && (
                              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm font-medium text-red-700">Error: {email.error_message}</p>
                              </div>
                            )}

                            {/* Linked receipts */}
                            {email.receipts.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-gray-500 mb-2">
                                  Linked Receipts ({email.receipts.length})
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {email.receipts.map((receipt) => (
                                    <div key={receipt.id} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                                      <a
                                        href={`/api/receipts/${receipt.id}/image`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded overflow-hidden"
                                      >
                                        {receipt.original_filename.toLowerCase().endsWith('.pdf') ? (
                                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">PDF</div>
                                        ) : (
                                          <img
                                            src={`/api/receipts/${receipt.id}/image`}
                                            alt=""
                                            className="w-full h-full object-cover"
                                          />
                                        )}
                                      </a>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{receipt.vendor || receipt.original_filename}</p>
                                        <div className="flex gap-3 text-xs text-gray-500">
                                          {receipt.amount && <span className="text-green-600 font-medium">${receipt.amount.toFixed(2)}</span>}
                                          {receipt.date && <span>{receipt.date}</span>}
                                          <span className="capitalize">{receipt.status}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Metadata */}
                            <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
                              <div>Message-ID: <span className="font-mono">{email.message_id || '-'}</span></div>
                              <div>To: {email.to_address || '-'}</div>
                              <div>Processed: {email.processed_at ? new Date(email.processed_at).toLocaleString() : '-'}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
