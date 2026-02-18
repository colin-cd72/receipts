import fs from 'fs'
import path from 'path'

const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN
const DROPBOX_FOLDER = process.env.DROPBOX_FOLDER || '/TGL/Receipts'

interface UploadResult {
  success: boolean
  path?: string
  error?: string
}

export async function uploadToDropbox(
  localFilePath: string,
  dropboxPath: string
): Promise<UploadResult> {
  if (!DROPBOX_ACCESS_TOKEN) {
    console.log('Dropbox not configured - skipping upload')
    return { success: false, error: 'Dropbox not configured' }
  }

  try {
    const fileBuffer = fs.readFileSync(localFilePath)

    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
          mode: 'add',
          autorename: true,
          mute: false,
        }),
      },
      body: fileBuffer,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Dropbox upload failed:', errorText)
      return { success: false, error: errorText }
    }

    const result = await response.json()
    console.log('Dropbox upload successful:', result.path_display)
    return { success: true, path: result.path_display }
  } catch (error) {
    console.error('Dropbox upload error:', error)
    return { success: false, error: String(error) }
  }
}

export async function uploadReceiptToDropbox(
  filename: string,
  vendor: string | null,
  amount: number | null,
  date: string | null,
  originalFilename: string
): Promise<UploadResult> {
  const localPath = path.join(process.cwd(), 'data', 'uploads', filename)

  if (!fs.existsSync(localPath)) {
    return { success: false, error: 'File not found' }
  }

  // Create smart filename: Vendor_$Amount.ext
  const ext = path.extname(originalFilename).toLowerCase()
  const safeVendor = (vendor || 'unknown').replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)
  const amountStr = amount ? amount.toFixed(2) : '0.00'
  const smartFilename = `${safeVendor}_$${amountStr}${ext}`

  // Organize by date folder under configured path
  const dateFolder = date || 'unknown-date'
  const basePath = DROPBOX_FOLDER.replace(/\/$/, '') // Remove trailing slash if any
  const dropboxPath = `${basePath}/${dateFolder}/${smartFilename}`

  return uploadToDropbox(localPath, dropboxPath)
}

export function isDropboxConfigured(): boolean {
  return !!DROPBOX_ACCESS_TOKEN
}
