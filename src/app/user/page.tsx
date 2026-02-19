'use client'

import { useState, useEffect } from 'react'
import {
  ChevronDown,
  ChevronUp,
  FileImage,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Search,
  Grid,
  List,
  LogOut,
  Download,
} from 'lucide-react'

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

export default function UserPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userName, setUserName] = useState('')
  const [loginError, setLoginError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table')

  useEffect(() => {
    const auth = sessionStorage.getItem('user_auth')
    if (auth === 'true') {
      setAuthenticated(true)
      setUserName(sessionStorage.getItem('user_name') || '')
      fetchReceipts()
    } else {
      setLoading(false)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')

    try {
      const res = await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (res.ok) {
        sessionStorage.setItem('user_auth', 'true')
        sessionStorage.setItem('user_name', data.name)
        sessionStorage.setItem('user_email', data.email)
        setAuthenticated(true)
        setUserName(data.name)
        fetchReceipts()
      } else {
        setLoginError(data.error || 'Invalid credentials')
      }
    } catch {
      setLoginError('Failed to connect')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('user_auth')
    sessionStorage.removeItem('user_name')
    sessionStorage.removeItem('user_email')
    setAuthenticated(false)
    setReceipts([])
    setEmail('')
    setPassword('')
  }

  const fetchReceipts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/receipts')
      const data = await res.json()
      setReceipts((data.receipts || []).filter((r: Receipt) => r.status === 'processed'))
    } catch (error) {
      console.error('Failed to fetch receipts:', error)
    }
    setLoading(false)
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

  const filteredReceipts = receipts.filter((r) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      r.vendor?.toLowerCase().includes(query) ||
      r.amount?.toString().includes(query) ||
      r.date?.includes(query) ||
      r.category?.toLowerCase().includes(query) ||
      r.description?.toLowerCase().includes(query) ||
      r.uploader_name?.toLowerCase().includes(query) ||
      r.raw_text?.toLowerCase().includes(query)
    )
  })

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
          <h1 className="text-2xl font-bold text-center mb-6">Receipt Viewer</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
            {loginError && (
              <p className="text-sm text-red-600">{loginError}</p>
            )}
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
          <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Signed in as <strong>{userName}</strong></span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Search and View Toggle */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by vendor, amount, date, category, uploader..."
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
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500">Total Receipts</p>
            <p className="text-2xl font-bold">{receipts.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border">
            <p className="text-sm text-gray-500">Showing</p>
            <p className="text-2xl font-bold text-blue-600">{filteredReceipts.length}</p>
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

        {/* Receipts */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <FileImage className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No processed receipts yet</p>
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
                <div className="p-3">
                  <p className="font-medium text-sm truncate">{receipt.vendor || 'Unknown Vendor'}</p>
                  <p className="text-lg font-bold text-green-600">
                    {receipt.amount ? `$${receipt.amount.toFixed(2)}` : '-'}
                  </p>
                  <p className="text-xs text-gray-500">{receipt.date || 'No date'}</p>
                  <p className="text-xs text-gray-400 truncate">{receipt.category || 'Uncategorized'}</p>
                  <p className="text-xs text-gray-400 mt-1 truncate">{receipt.uploader_name}</p>
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Vendor</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Category</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Uploaded By</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                  <th className="w-10"></th>
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
                      <td className="px-4 py-3 text-sm">{receipt.date || '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium">{receipt.vendor || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {receipt.amount ? `${receipt.currency} ${receipt.amount.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">{receipt.category || '-'}</td>
                      <td className="px-4 py-3 text-sm">{receipt.uploader_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(receipt.status)}
                          <span className="text-sm capitalize">{receipt.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {expandedId === receipt.id ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
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
                              <div>
                                <a
                                  href={`/api/receipts/${receipt.id}/download?filename=${encodeURIComponent(getSmartFilename(receipt))}`}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100"
                                >
                                  <Download className="w-4 h-4" />
                                  Download
                                </a>
                              </div>
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
