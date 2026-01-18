import { NextRequest, NextResponse } from 'next/server'
import { getAllReceipts, getReceiptsByStatus } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const status = searchParams.get('status')

    const receipts = status ? getReceiptsByStatus(status) : getAllReceipts()

    if (format === 'csv') {
      const csv = generateCSV(receipts)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="receipts-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    if (format === 'workday') {
      const csv = generateWorkdayCSV(receipts)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="workday-expenses-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json({ receipts })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}

interface Receipt {
  id: number
  vendor: string | null
  amount: number | null
  currency: string
  date: string | null
  category: string | null
  description: string | null
  payment_method: string | null
  uploader_name: string
  uploader_email: string | null
  original_filename: string
  status: string
  created_at: string
}

function generateCSV(receipts: Receipt[]): string {
  const headers = [
    'ID',
    'Date',
    'Vendor',
    'Amount',
    'Currency',
    'Category',
    'Description',
    'Payment Method',
    'Uploaded By',
    'Email',
    'Original Filename',
    'Status',
    'Upload Date',
  ]

  const rows = receipts.map((r) => [
    r.id,
    r.date || '',
    r.vendor || '',
    r.amount || '',
    r.currency,
    r.category || '',
    r.description || '',
    r.payment_method || '',
    r.uploader_name,
    r.uploader_email || '',
    r.original_filename,
    r.status,
    r.created_at,
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  return csvContent
}

function generateWorkdayCSV(receipts: Receipt[]): string {
  // Workday-compatible format
  const headers = [
    'Expense Date',
    'Merchant',
    'Amount',
    'Currency',
    'Expense Item',
    'Memo',
    'Payment Type',
    'Worker',
  ]

  const rows = receipts
    .filter((r) => r.status === 'processed')
    .map((r) => [
      r.date || '',
      r.vendor || '',
      r.amount || '',
      r.currency,
      mapToWorkdayCategory(r.category),
      r.description || '',
      r.payment_method || 'Corporate Card',
      r.uploader_name,
    ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  return csvContent
}

function mapToWorkdayCategory(category: string | null): string {
  // Map internal categories to Workday expense items
  const mapping: Record<string, string> = {
    'Meals & Entertainment': 'Meals',
    'Travel - Airfare': 'Airfare',
    'Travel - Lodging': 'Hotel',
    'Travel - Ground Transportation': 'Ground Transportation',
    'Office Supplies': 'Office Supplies',
    Equipment: 'Equipment',
    'Software & Subscriptions': 'Software',
    'Professional Services': 'Professional Services',
    'Training & Education': 'Training',
    Communication: 'Telephone',
    'Shipping & Postage': 'Postage',
    Other: 'Miscellaneous',
  }

  return mapping[category || ''] || 'Miscellaneous'
}
