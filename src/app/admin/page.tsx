'use client'

import { useState, useEffect, useCallback } from 'react'
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
  X,
  Search,
  Grid,
  List,
  Archive,
  Cloud,
  AlertTriangle,
  Mail,
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
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table')
  const [reviewCount, setReviewCount] = useState(0)

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
      const [receiptsRes, reviewRes] = await Promise.all([
        fetch('/api/receipts'),
        fetch('/api/receipts/review'),
      ])
      const receiptsData = await receiptsRes.json()
      const reviewData = await reviewRes.json()
      setReceipts(receiptsData.receipts || [])
      setReviewCount(reviewData.receipts?.length || 0)
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
  const [syncingDropbox, setSyncingDropbox] = useState(false)
  const [dropboxModal, setDropboxModal] = useState<{
    show: boolean
    total: number
    current: number
    success: number
    failed: number
    skipped: number
    alreadyInDropbox: number
    currentFile: string
    errors: string[]
    complete: boolean
  } | null>(null)
  const [processingProgress, setProcessingProgress] = useState<{
    total: number
    processed: number
    processing: number
    errors: number
    active: boolean
  } | null>(null)

  // Poll for progress updates when reprocessing
  const pollProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/receipts')
      const data = await res.json()
      const allReceipts = data.receipts || []
      setReceipts(allReceipts)

      if (processingProgress?.active) {
        const processing = allReceipts.filter((r: Receipt) => r.status === 'processing').length
        const processed = allReceipts.filter(
          (r: Receipt) => r.status === 'processed' && (r.vendor || r.amount)
        ).length
        const errors = allReceipts.filter((r: Receipt) => r.status === 'error').length

        setProcessingProgress((prev) => {
          if (!prev) return null
          const newProgress = {
            ...prev,
            processing,
            processed,
            errors,
          }
          // Stop polling when all done
          if (processing === 0 && prev.processing > 0) {
            return { ...newProgress, active: false }
          }
          return newProgress
        })
      }
    } catch (error) {
      console.error('Failed to poll progress:', error)
    }
  }, [processingProgress?.active])

  useEffect(() => {
    if (!processingProgress?.active) return

    const interval = setInterval(pollProgress, 2000)
    return () => clearInterval(interval)
  }, [processingProgress?.active, pollProgress])

  const handleReprocessAll = async () => {
    const toProcess = receipts.filter(
      (r) =>
        r.status === 'pending' ||
        r.status === 'error' ||
        r.status === 'processing' ||
        (r.status === 'processed' && !r.vendor && !r.amount)
    )

    if (toProcess.length === 0) {
      alert('No receipts to reprocess')
      return
    }

    if (!confirm(`Reprocess ${toProcess.length} receipts?`)) return

    // Initialize progress tracking
    setProcessingProgress({
      total: toProcess.length,
      processed: 0,
      processing: toProcess.length,
      errors: 0,
      active: true,
    })

    setReprocessing(true)
    try {
      await fetch('/api/receipts/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch (error) {
      console.error('Failed to reprocess:', error)
      alert('Failed to start reprocessing')
      setProcessingProgress(null)
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

  const handleSyncDropbox = async () => {
    // Calculate counts before API call so modal shows immediately
    const processedCount = receipts.filter(r => r.status === 'processed').length
    const notProcessedCount = receipts.length - processedCount

    setSyncingDropbox(true)
    setDropboxModal({
      show: true,
      total: processedCount,
      current: 0,
      success: 0,
      failed: 0,
      skipped: notProcessedCount,
      alreadyInDropbox: 0,
      currentFile: 'Syncing to Dropbox...',
      errors: [],
      complete: false,
    })

    try {
      const res = await fetch('/api/export/dropbox', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        setDropboxModal({
          show: true,
          total: data.total || 0,
          current: data.total || 0,
          success: data.success || 0,
          failed: data.failed || 0,
          skipped: data.skipped || 0,
          alreadyInDropbox: data.alreadyInDropbox || 0,
          currentFile: '',
          errors: data.errors || [],
          complete: true,
        })
      } else {
        alert(`Sync failed: ${data.error}`)
        setDropboxModal(null)
      }
    } catch (error) {
      console.error('Failed to sync to Dropbox:', error)
      alert('Failed to sync to Dropbox')
      setDropboxModal(null)
    }
    setSyncingDropbox(false)
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

  // Filter receipts based on search query
  const filteredReceipts = receipts.filter((r) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      (r.vendor?.toLowerCase().includes(query)) ||
      (r.amount?.toString().includes(query)) ||
      (r.date?.includes(query)) ||
      (r.category?.toLowerCase().includes(query)) ||
      (r.description?.toLowerCase().includes(query)) ||
      (r.uploader_name?.toLowerCase().includes(query))
    )
  })

  // Generate smart filename for a receipt
  const getSmartFilename = (receipt: Receipt) => {
    const date = receipt.date || 'unknown-date'
    const vendor = (receipt.vendor || 'unknown').replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)
    const amount = receipt.amount ? receipt.amount.toFixed(2) : '0.00'
    const ext = receipt.original_filename.split('.').pop() || 'pdf'
    return `${date}_${vendor}_$${amount}.${ext}`
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
              href="/admin/inbox"
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition"
            >
              <Mail className="w-4 h-4" />
              Inbox
            </Link>
            {reviewCount > 0 && (
              <Link
                href="/admin/review"
                className="flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-200 transition"
              >
                <AlertTriangle className="w-4 h-4" />
                Review ({reviewCount})
              </Link>
            )}
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
            <a
              href="/api/export/zip"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <Archive className="w-4 h-4" />
              Download ZIP
            </a>
            <button
              onClick={handleSyncDropbox}
              disabled={syncingDropbox}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition disabled:opacity-50"
            >
              {syncingDropbox ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              Sync Dropbox
            </button>
          </div>
        </div>

        {/* Search and View Toggle */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by vendor, amount, date, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded ${viewMode === 'table' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}
              title="Table View"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`p-2 rounded ${viewMode === 'gallery' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}
              title="Gallery View"
            >
              <Grid className="w-5 h-5" />
            </button>
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

        {/* Processing Progress Bar */}
        {processingProgress && (
          <div className="bg-white p-4 rounded-xl border mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {processingProgress.active ? (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                <span className="font-medium">
                  {processingProgress.active ? 'Processing Receipts...' : 'Processing Complete'}
                </span>
              </div>
              <button
                onClick={() => setProcessingProgress(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
              <div
                className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-green-500"
                style={{
                  width: `${Math.round(
                    ((processingProgress.processed + processingProgress.errors) /
                      processingProgress.total) *
                      100
                  )}%`,
                }}
              />
            </div>

            {/* Stats */}
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>
                  Processed: <strong>{processingProgress.processed}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                <span>
                  In Progress: <strong>{processingProgress.processing}</strong>
                </span>
              </div>
              {processingProgress.errors > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>
                    Errors: <strong>{processingProgress.errors}</strong>
                  </span>
                </div>
              )}
              <div className="ml-auto text-gray-500">
                {processingProgress.processed + processingProgress.errors} of{' '}
                {processingProgress.total}
              </div>
            </div>
          </div>
        )}

        {/* Receipts */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <FileImage className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No receipts uploaded yet</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No receipts match your search</p>
          </div>
        ) : viewMode === 'gallery' ? (
          /* Gallery View */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredReceipts.map((receipt) => (
              <div
                key={receipt.id}
                className="bg-white rounded-xl border overflow-hidden hover:shadow-lg transition"
              >
                {/* Thumbnail */}
                <a
                  href={`/api/receipts/${receipt.id}/image`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-[3/4] bg-gray-100 relative"
                >
                  {receipt.original_filename.toLowerCase().endsWith('.pdf') ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <FileImage className="w-12 h-12 mx-auto mb-2" />
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
                  <div className="absolute top-2 right-2">
                    {getStatusIcon(receipt.status)}
                  </div>
                </a>

                {/* Info */}
                <div className="p-3">
                  <p className="font-medium text-sm truncate">{receipt.vendor || 'Unknown Vendor'}</p>
                  <p className="text-lg font-bold text-green-600">
                    {receipt.amount ? `$${receipt.amount.toFixed(2)}` : '-'}
                  </p>
                  <p className="text-xs text-gray-500">{receipt.date || 'No date'}</p>
                  <p className="text-xs text-gray-400 truncate">{receipt.category || 'Uncategorized'}</p>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <a
                      href={`/api/receipts/${receipt.id}/download?filename=${encodeURIComponent(getSmartFilename(receipt))}`}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                    <button
                      onClick={() => handleDelete(receipt.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
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
                {filteredReceipts.map((receipt) => (
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
                          <a
                            href={`/api/receipts/${receipt.id}/download?filename=${encodeURIComponent(getSmartFilename(receipt))}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title={`Download as ${getSmartFilename(receipt)}`}
                          >
                            <Download className="w-4 h-4" />
                          </a>
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

        {/* Dropbox Sync Modal */}
        {dropboxModal?.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
              {/* Header */}
              <div className="bg-sky-600 px-6 py-4 flex items-center gap-3">
                <Cloud className="w-6 h-6 text-white" />
                <h2 className="text-lg font-semibold text-white">
                  {dropboxModal.complete ? 'Dropbox Sync Complete' : 'Syncing to Dropbox'}
                </h2>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>
                      {dropboxModal.complete
                        ? `Uploaded ${dropboxModal.success} of ${dropboxModal.total} files`
                        : dropboxModal.total === 0
                        ? 'No processed receipts to sync'
                        : `Syncing ${dropboxModal.total} receipts...`}
                    </span>
                    <span>
                      {dropboxModal.complete && dropboxModal.total > 0
                        ? '100%'
                        : dropboxModal.complete
                        ? '-'
                        : ''}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        dropboxModal.complete
                          ? 'bg-green-500'
                          : 'bg-sky-500 animate-pulse'
                      }`}
                      style={{
                        width: dropboxModal.complete
                          ? '100%'
                          : dropboxModal.total > 0
                          ? '50%'
                          : '0%',
                      }}
                    />
                  </div>
                </div>

                {/* Current File */}
                {!dropboxModal.complete && dropboxModal.currentFile && (
                  <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                    <span className="truncate">{dropboxModal.currentFile}</span>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{dropboxModal.success}</p>
                    <p className="text-xs text-green-700">Uploaded</p>
                  </div>
                  <div className="bg-sky-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-sky-600">{dropboxModal.alreadyInDropbox}</p>
                    <p className="text-xs text-sky-700">Already There</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-600">{dropboxModal.skipped}</p>
                    <p className="text-xs text-gray-700">Not Processed</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{dropboxModal.failed}</p>
                    <p className="text-xs text-red-700">Failed</p>
                  </div>
                </div>

                {/* Errors */}
                {dropboxModal.errors.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-red-600 mb-2">Errors:</p>
                    <div className="bg-red-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {dropboxModal.errors.map((error, i) => (
                        <p key={i} className="text-xs text-red-700 mb-1">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Close Button */}
                {dropboxModal.complete && (
                  <button
                    onClick={() => setDropboxModal(null)}
                    className="w-full bg-sky-600 text-white py-2 rounded-lg hover:bg-sky-700 transition"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
