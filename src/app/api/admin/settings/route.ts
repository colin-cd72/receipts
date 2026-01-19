import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'

const envPath = path.join(process.cwd(), '.env')

function parseEnvFile(): Record<string, string> {
  if (!existsSync(envPath)) {
    return {}
  }
  const content = readFileSync(envPath, 'utf-8')
  const env: Record<string, string> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key) {
        env[key.trim()] = valueParts.join('=').trim()
      }
    }
  }

  return env
}

function writeEnvFile(env: Record<string, string>): void {
  const content = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  writeFileSync(envPath, content + '\n')
}

export async function GET() {
  try {
    const env = parseEnvFile()

    // Mask the API key for display (show first 10 and last 4 chars)
    let maskedKey = ''
    if (env.ANTHROPIC_API_KEY) {
      const key = env.ANTHROPIC_API_KEY
      if (key.length > 14) {
        maskedKey = key.substring(0, 10) + '...' + key.substring(key.length - 4)
      } else {
        maskedKey = '***configured***'
      }
    }

    return NextResponse.json({
      apiKey: env.ANTHROPIC_API_KEY || '',
      maskedKey,
      hasApiKey: !!env.ANTHROPIC_API_KEY,
      smtpHost: env.SMTP_HOST || '',
      smtpPort: env.SMTP_PORT || '587',
      smtpUser: env.SMTP_USER || '',
      smtpPass: env.SMTP_PASS || '',
      smtpFrom: env.SMTP_FROM || '',
      notifyEmail: env.NOTIFY_EMAIL || '',
    })
  } catch (error) {
    console.error('Error reading settings:', error)
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey, adminPassword, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, notifyEmail } = await request.json()

    const env = parseEnvFile()

    if (apiKey !== undefined && apiKey.trim()) {
      env.ANTHROPIC_API_KEY = apiKey.trim()
      process.env.ANTHROPIC_API_KEY = apiKey.trim()
    }

    if (adminPassword && adminPassword.trim()) {
      env.ADMIN_PASSWORD = adminPassword.trim()
      process.env.ADMIN_PASSWORD = adminPassword.trim()
    }

    // SMTP settings
    const smtpFields = [
      { key: 'SMTP_HOST', value: smtpHost },
      { key: 'SMTP_PORT', value: smtpPort },
      { key: 'SMTP_USER', value: smtpUser },
      { key: 'SMTP_PASS', value: smtpPass },
      { key: 'SMTP_FROM', value: smtpFrom },
      { key: 'NOTIFY_EMAIL', value: notifyEmail },
    ]

    for (const { key, value } of smtpFields) {
      if (value !== undefined) {
        if (value.trim()) {
          env[key] = value.trim()
          process.env[key] = value.trim()
        } else {
          delete env[key]
          delete process.env[key]
        }
      }
    }

    writeEnvFile(env)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
