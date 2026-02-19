import fs from 'fs'
import path from 'path'

const DROPBOX_FOLDER = process.env.DROPBOX_FOLDER || '/TGL/Receipts'

// Token cache for automatic refresh
let cachedAccessToken: string | null = null
let tokenExpiresAt: number = 0

interface UploadResult {
  success: boolean
  path?: string
  error?: string
  skipped?: boolean
}

// Get a valid access token, refreshing if necessary
async function getAccessToken(): Promise<string | null> {
  // Check for legacy static token first (backwards compatible)
  const staticToken = process.env.DROPBOX_ACCESS_TOKEN
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN
  const appKey = process.env.DROPBOX_APP_KEY
  const appSecret = process.env.DROPBOX_APP_SECRET

  // If no refresh token configured, fall back to static token
  if (!refreshToken || !appKey || !appSecret) {
    return staticToken || null
  }

  // Check if cached token is still valid (with 5 min buffer)
  const now = Date.now()
  if (cachedAccessToken && tokenExpiresAt > now + 300000) {
    return cachedAccessToken
  }

  // Refresh the token
  try {
    console.log('Refreshing Dropbox access token...')
    const response = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: appKey,
        client_secret: appSecret,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to refresh Dropbox token:', errorText)
      // Fall back to static token if refresh fails
      return staticToken || null
    }

    const data = await response.json()
    cachedAccessToken = data.access_token
    // expires_in is in seconds, convert to milliseconds and add to current time
    tokenExpiresAt = now + (data.expires_in * 1000)
    console.log('Dropbox token refreshed, expires in', data.expires_in, 'seconds')
    return cachedAccessToken
  } catch (error) {
    console.error('Error refreshing Dropbox token:', error)
    // Fall back to static token
    return staticToken || null
  }
}

// Check if a file already exists in Dropbox
async function fileExistsInDropbox(dropboxPath: string): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false

  try {
    const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: dropboxPath }),
    })

    if (response.ok) {
      return true // File exists
    }

    // 409 with path/not_found means file doesn't exist
    return false
  } catch {
    return false
  }
}

export async function uploadToDropbox(
  localFilePath: string,
  dropboxPath: string,
  skipIfExists: boolean = true
): Promise<UploadResult> {
  const token = await getAccessToken()
  if (!token) {
    console.log('Dropbox not configured - skipping upload')
    return { success: false, error: 'Dropbox not configured' }
  }

  try {
    // Check if file already exists
    if (skipIfExists) {
      const exists = await fileExistsInDropbox(dropboxPath)
      if (exists) {
        console.log('File already exists in Dropbox, skipping:', dropboxPath)
        return { success: true, path: dropboxPath, skipped: true }
      }
    }

    const fileBuffer = fs.readFileSync(localFilePath)

    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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
  originalFilename: string,
  skipIfExists: boolean = true
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

  return uploadToDropbox(localPath, dropboxPath, skipIfExists)
}

export function isDropboxConfigured(): boolean {
  const hasRefreshToken = !!(
    process.env.DROPBOX_REFRESH_TOKEN &&
    process.env.DROPBOX_APP_KEY &&
    process.env.DROPBOX_APP_SECRET
  )
  const hasStaticToken = !!process.env.DROPBOX_ACCESS_TOKEN
  return hasRefreshToken || hasStaticToken
}

// List folders in Dropbox
export async function listDropboxFolders(): Promise<string[]> {
  const token = await getAccessToken()
  if (!token) return []

  try {
    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: DROPBOX_FOLDER,
        recursive: false,
      }),
    })

    if (!response.ok) {
      console.error('Failed to list Dropbox folders')
      return []
    }

    const data = await response.json()
    return data.entries
      .filter((entry: { '.tag': string }) => entry['.tag'] === 'folder')
      .map((entry: { name: string }) => entry.name)
  } catch (error) {
    console.error('Error listing Dropbox folders:', error)
    return []
  }
}

// Delete a folder from Dropbox
export async function deleteDropboxFolder(folderName: string): Promise<{ success: boolean; error?: string }> {
  const token = await getAccessToken()
  if (!token) {
    return { success: false, error: 'Dropbox not configured' }
  }

  const folderPath = `${DROPBOX_FOLDER}/${folderName}`

  try {
    const response = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: folderPath }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to delete Dropbox folder:', errorText)
      return { success: false, error: errorText }
    }

    console.log('Deleted Dropbox folder:', folderPath)
    return { success: true }
  } catch (error) {
    console.error('Error deleting Dropbox folder:', error)
    return { success: false, error: String(error) }
  }
}
