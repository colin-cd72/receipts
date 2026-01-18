'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface UploadStatus {
  filename: string
  status: 'uploading' | 'processing' | 'success' | 'error'
  message?: string
}

export default function ReceiptUploader() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [uploads, setUploads] = useState<UploadStatus[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!name.trim()) {
        alert('Please enter your name before uploading')
        return
      }

      setIsUploading(true)

      for (const file of acceptedFiles) {
        const uploadStatus: UploadStatus = {
          filename: file.name,
          status: 'uploading',
        }
        setUploads((prev) => [...prev, uploadStatus])

        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('name', name.trim())
          formData.append('email', email.trim())

          const response = await fetch('/api/receipts', {
            method: 'POST',
            body: formData,
          })

          const result = await response.json()

          if (response.ok) {
            setUploads((prev) =>
              prev.map((u) =>
                u.filename === file.name
                  ? { ...u, status: 'success', message: result.message }
                  : u
              )
            )
          } else {
            setUploads((prev) =>
              prev.map((u) =>
                u.filename === file.name
                  ? { ...u, status: 'error', message: result.error }
                  : u
              )
            )
          }
        } catch (error) {
          setUploads((prev) =>
            prev.map((u) =>
              u.filename === file.name
                ? { ...u, status: 'error', message: 'Upload failed' }
                : u
            )
          )
        }
      }

      setIsUploading(false)
    },
    [name, email]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
    disabled: isUploading,
  })

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Your Name *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="John Smith"
            required
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email (optional)
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="john@company.com"
          />
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          ${!name.trim() ? 'opacity-50' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-lg text-blue-600">Drop your receipts here...</p>
        ) : (
          <>
            <p className="text-lg text-gray-600">
              Drag & drop receipts here, or click to select
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Supports: JPG, PNG, GIF, WebP, PDF
            </p>
          </>
        )}
      </div>

      {/* Upload Status */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-700">Upload Status</h3>
          {uploads.map((upload, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border"
            >
              {upload.status === 'uploading' && (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              )}
              {upload.status === 'processing' && (
                <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
              )}
              {upload.status === 'success' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {upload.status === 'error' && (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {upload.filename}
                </p>
                {upload.message && (
                  <p
                    className={`text-xs ${
                      upload.status === 'error' ? 'text-red-500' : 'text-gray-500'
                    }`}
                  >
                    {upload.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
