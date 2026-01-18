import ReceiptUploader from '@/components/ReceiptUploader'
import { Receipt } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Receipt className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Receipt Upload</h1>
          <p className="text-gray-600 mt-2">
            Upload your receipts for expense reporting
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <ReceiptUploader />
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Receipts are automatically analyzed and organized.</p>
          <p className="mt-1">
            Questions? Contact your expense administrator.
          </p>
        </div>
      </div>
    </main>
  )
}
