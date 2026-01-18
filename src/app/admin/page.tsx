'use client'

import { useState, useEffect } from 'react'
import {
  Download,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileImage,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Settings,
  RotateCcw,
} from 'lucide-react'
import Link from 'next/link'

interface Receipt {
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

export default function AdminPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')

  useEffect(() => {
    // Check if already authenticated via session
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
      const res = await fetch('/api/receipts')
      const data = await res.json()
      setReceipts(data.receipts || [])
    } catch (error) {
      console.error('Failed to fetch receipts:', error)
    }
    setLoading(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return

    try {
      await fetch(`/api/receipts/${id}`, { method: 'DELETE' })
      setReceipts((prev) => prev.filter((r) => r.id !== id))
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const [reprocessing, setReprocessing] = useState(false)

  const handleReprocessAll = async () => {
    const pendingCount = receipts.filter(
      (r) =>
        r.status === 'pending' ||
        r.status === 'error' ||
        r.status === 'processing' ||
        (r.status === 'processed' && !r.vendor && !r.amount)
    ).length

    if (pendingCount === 0) {
      alert('No receipts to reprocess')
      return
    }

    if (!confirm(`Reprocess ${pendingCount} receipts?`)) return

    setReprocessing(true)
    try {
      await fetch('/api/receipts/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      alert(`Reprocessing ${pendingCount} receipts. Refresh in a moment to see results.`)
    } catch (error) {
      console.error('Failed to reprocess:', error)
      alert('Failed to start reprocessing')
    }
    setReprocessing(false)
  }

  const handleReprocessOne = async (id: number) => {
    try {
      setReceipts((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'processing' } : r))
      )
      await fetch('/api/receipts/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch (error) {
      console.error('Failed to reprocess:', error)
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
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Receipt Admin</h1>
          <div className="flex gap-3">
            <Link
              href="/admin/settings"
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <button
              onClick={fetchReceipts}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleReprocessAll}
              disabled={reprocessing}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition disabled:opacity-50"
            >
              {reprocessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Reprocess All
            </button>
            <a
              href="/api/export?format=csv"
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </a>
            <a
              href="/api/export?format=workday"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Download className="w-4 h-4" />
              Workday Export
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500">Total Receipts</p>
            <p className="text-2xl font-bold">{receipts.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500">Processed</p>
            <p className="text-2xl font-bold text-green-600">
              {receipts.filter((r) => r.status === 'processed').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {receipts.filter((r) => r.status === 'pending' || r.status === 'processing').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-2xl font-bold">
              ${receipts
                .filter((r) => r.amount)
                .reduce((sum, r) => sum + (r.amount || 0), 0)
                .toFixed(2)}
            </p>
          </div>
        </div>

        {/* Receipts Table */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <FileImage className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No receipts uploaded yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Vendor</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Category</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Uploaded By</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <>
                    <tr
                      key={receipt.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === receipt.id ? null : receipt.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(receipt.status)}
                          <span className="text-sm capitalize">{receipt.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{receipt.date || '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium">{receipt.vendor || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {receipt.amount ? `${receipt.currency} ${receipt.amount.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">{receipt.category || '-'}</td>
                      <td className="px-4 py-3 text-sm">{receipt.uploader_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {(receipt.status === 'error' ||
                            receipt.status === 'pending' ||
                            (receipt.status === 'processed' && !receipt.vendor && !receipt.amount)) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleReprocessOne(receipt.id)
                              }}
                              className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"
                              title="Reprocess"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(receipt.id)
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {expandedId === receipt.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === receipt.id && (
                      <tr key={`${receipt.id}-details`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="flex gap-6">
                            {/* Receipt Image Preview */}
                            <div className="flex-shrink-0">
                              <p className="text-gray-500 text-sm mb-2">Receipt Image</p>
                              <a
                                href={`/api/receipts/${receipt.id}/image`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                {receipt.original_filename.toLowerCase().endsWith('.pdf') ? (
                                  <div className="w-48 h-64 bg-gray-100 border rounded-lg flex items-center justify-center text-gray-400">
                                    <div className="text-center">
                                      <FileImage className="w-12 h-12 mx-auto mb-2" />
                                      <p className="text-sm">PDF Document</p>
                                      <p className="text-xs mt-1">Click to view</p>
                                    </div>
                                  </div>
                                ) : (
                                  <img
                                    src={`/api/receipts/${receipt.id}/image`}
                                    alt={receipt.original_filename}
                                    className="max-w-48 max-h-64 object-contain border rounded-lg bg-white cursor-pointer hover:opacity-90 transition"
                                  />
                                )}
                              </a>
                            </div>
                            {/* Receipt Details */}
                            <div className="flex-1 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Original Filename</p>
                                <p className="font-medium">{receipt.original_filename}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Email</p>
                                <p className="font-medium">{receipt.uploader_email || '-'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Description</p>
                                <p className="font-medium">{receipt.description || '-'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Payment Method</p>
                                <p className="font-medium">{receipt.payment_method || '-'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Upload Date</p>
                                <p className="font-medium">
                                  {new Date(receipt.created_at).toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Processed At</p>
                                <p className="font-medium">
                                  {receipt.processed_at
                                    ? new Date(receipt.processed_at).toLocaleString()
                                    : '-'}
                                </p>
                              </div>
                              {receipt.raw_text && (
                                <div className="col-span-2">
                                  <p className="text-gray-500">Raw Text</p>
                                  <pre className="mt-1 p-2 bg-white border rounded text-xs overflow-auto max-h-32">
                                    {receipt.raw_text}
                                  </pre>
                                </div>
                              )}
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
