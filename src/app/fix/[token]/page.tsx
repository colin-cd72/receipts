'use client'

import { useState, useEffect, use } from 'react'
import { Save, Loader2, CheckCircle, AlertCircle, FileImage, Receipt } from 'lucide-react'

interface ReceiptData {
  id: number
  original_filename: string
  vendor: string | null
  amount: number | null
  date: string | null
  category: string | null
  uploader_name: string
}

const EXPENSE_CATEGORIES = [
  'Meals & Entertainment',
  'Travel - Airfare',
  'Travel - Lodging',
  'Travel - Ground Transportation',
  'Office Supplies',
  'Equipment',
  'Software & Subscriptions',
  'Professional Services',
  'Training & Education',
  'Communication',
  'Shipping & Postage',
  'Other',
]

export default function FixReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    fetchReceipt()
  }, [token])

  const fetchReceipt = async () => {
    try {
      const res = await fetch(`/api/fix/${token}`)
      if (res.ok) {
        const data = await res.json()
        setReceipt(data.receipt)
        setVendor(data.receipt.vendor || '')
        setAmount(data.receipt.amount?.toString() || '')
        setDate(data.receipt.date || '')
        setCategory(data.receipt.category || '')
      } else {
        setError('This link is invalid or has expired.')
      }
    } catch {
      setError('Failed to load receipt.')
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!vendor.trim()) {
      alert('Please enter the vendor/merchant name')
      return
    }
    if (!amount.trim() || isNaN(parseFloat(amount))) {
      alert('Please enter a valid amount')
      return
    }
    if (!date) {
      alert('Please select the date')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/fix/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: vendor.trim(),
          amount: parseFloat(amount),
          date,
          category: category || null,
        }),
      })

      if (res.ok) {
        setSaved(true)
      } else {
        alert('Failed to save. Please try again.')
      }
    } catch {
      alert('Failed to save. Please try again.')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Invalid</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600">Your receipt has been updated successfully.</p>
          <p className="text-gray-500 text-sm mt-2">You can close this page now.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
            <Receipt className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Complete Your Receipt</h1>
          <p className="text-gray-600 mt-2">
            Hi {receipt?.uploader_name}, please fill in the missing information below.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          {/* Receipt Image */}
          <div className="bg-gray-100 p-4">
            <p className="text-sm text-gray-500 mb-2">Your Receipt:</p>
            <a
              href={`/api/receipts/${receipt?.id}/image`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {receipt?.original_filename.toLowerCase().endsWith('.pdf') ? (
                <div className="bg-white rounded-lg p-8 text-center">
                  <FileImage className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600">PDF Document</p>
                  <p className="text-sm text-blue-600 mt-1">Click to view</p>
                </div>
              ) : (
                <img
                  src={`/api/receipts/${receipt?.id}/image`}
                  alt="Receipt"
                  className="max-h-80 mx-auto rounded-lg shadow-sm"
                />
              )}
            </a>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor / Merchant *
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g., Starbucks, Amazon, United Airlines"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount ($) *
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                min="2025-10-01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Select a category...</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
