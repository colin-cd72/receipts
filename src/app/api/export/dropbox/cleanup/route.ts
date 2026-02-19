import { NextResponse } from 'next/server'
import { listDropboxFolders, deleteDropboxFolder, isDropboxConfigured } from '@/lib/dropbox'

export async function POST() {
  try {
    if (!isDropboxConfigured()) {
      return NextResponse.json(
        { error: 'Dropbox is not configured' },
        { status: 400 }
      )
    }

    const folders = await listDropboxFolders()

    // Find folders with dates before October 1, 2025
    const oldFolders = folders.filter(folder => {
      // Match date folders like "2021-01-15" or "2025-09-25"
      const dateMatch = folder.match(/^(\d{4}-\d{2}-\d{2})$/)
      if (dateMatch) {
        return folder < '2025-10-01'
      }
      return false
    })

    const results = {
      found: oldFolders.length,
      deleted: 0,
      errors: [] as string[],
      deletedFolders: [] as string[],
    }

    // Delete each old folder
    for (const folder of oldFolders) {
      const result = await deleteDropboxFolder(folder)
      if (result.success) {
        results.deleted++
        results.deletedFolders.push(folder)
      } else {
        results.errors.push(`${folder}: ${result.error}`)
      }
    }

    return NextResponse.json({
      message: `Deleted ${results.deleted} old folders from Dropbox`,
      ...results,
    })
  } catch (error) {
    console.error('Dropbox cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup Dropbox' },
      { status: 500 }
    )
  }
}
