'use client'

import { useState, useEffect } from 'react'
import { Settings, Key, CheckCircle, AlertCircle, Loader2, ArrowLeft, Mail, Cloud, Inbox } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)

  const [apiKey, setApiKey] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [smtpFrom, setSmtpFrom] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [dropboxToken, setDropboxToken] = useState('')
  const [dropboxFolder, setDropboxFolder] = useState('/TGL/Receipts')
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState('993')
  const [imapUser, setImapUser] = useState('')
  const [imapPass, setImapPass] = useState('')
  const [imapMailbox, setImapMailbox] = useState('INBOX')
  const [imapPollInterval, setImapPollInterval] = useState('60')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testingImap, setTestingImap] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (auth === 'true') {
      setAuthenticated(true)
      loadSettings()
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
      loadSettings()
    } else {
      alert('Invalid password')
    }
  }

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings')
      const data = await res.json()
      setApiKey(data.apiKey || '')
      setSmtpHost(data.smtpHost || '')
      setSmtpPort(data.smtpPort || '587')
      setSmtpUser(data.smtpUser || '')
      setSmtpPass(data.smtpPass || '')
      setSmtpFrom(data.smtpFrom || '')
      setNotifyEmail(data.notifyEmail || '')
      setDropboxToken(data.dropboxToken || '')
      setDropboxFolder(data.dropboxFolder || '/TGL/Receipts')
      setImapHost(data.imapHost || '')
      setImapPort(data.imapPort || '993')
      setImapUser(data.imapUser || '')
      setImapPass(data.imapPass || '')
      setImapMailbox(data.imapMailbox || 'INBOX')
      setImapPollInterval(data.imapPollInterval || '60')
      setAdminPassword('')
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
    setLoading(false)
  }

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          adminPassword: adminPassword.trim() || undefined,
          smtpHost: smtpHost.trim() || undefined,
          smtpPort: smtpPort.trim() || undefined,
          smtpUser: smtpUser.trim() || undefined,
          smtpPass: smtpPass.trim() || undefined,
          smtpFrom: smtpFrom.trim() || undefined,
          notifyEmail: notifyEmail.trim() || undefined,
          dropboxToken: dropboxToken.trim() || undefined,
          dropboxFolder: dropboxFolder.trim() || undefined,
          imapHost: imapHost.trim() || undefined,
          imapPort: imapPort.trim() || undefined,
          imapUser: imapUser.trim() || undefined,
          imapPass: imapPass.trim() || undefined,
          imapMailbox: imapMailbox.trim() || undefined,
          imapPollInterval: imapPollInterval.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' })
        setAdminPassword('')
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    }

    setSaving(false)
  }

  const testEmail = async () => {
    setTestingEmail(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: smtpHost.trim(),
          smtpPort: smtpPort.trim(),
          smtpUser: smtpUser.trim(),
          smtpPass: smtpPass.trim(),
          smtpFrom: smtpFrom.trim(),
          notifyEmail: notifyEmail.trim(),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'Test email sent successfully!' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send test email' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send test email' })
    }

    setTestingEmail(false)
  }

  const testApiKey = async () => {
    setTesting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: `API key is valid! Model: ${data.model}` })
      } else {
        setMessage({ type: 'error', text: data.error || 'API key test failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to test API key' })
    }

    setTesting(false)
  }

  const testImap = async () => {
    setTestingImap(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/settings/test-imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imapHost: imapHost.trim(),
          imapPort: imapPort.trim(),
          imapUser: imapUser.trim(),
          imapPass: imapPass.trim(),
          imapMailbox: imapMailbox.trim(),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({
          type: 'success',
          text: `IMAP connected! Mailbox: ${imapMailbox || 'INBOX'} — ${data.messages} total, ${data.unseen} unseen, ${data.recent} recent`,
        })
      } else {
        setMessage({ type: 'error', text: data.error || 'IMAP connection failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to test IMAP connection' })
    }

    setTestingImap(false)
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
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin"
            className="p-2 hover:bg-gray-200 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-gray-600" />
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : (
          <form onSubmit={saveSettings} className="space-y-6">
            {/* API Key Section */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Key className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Anthropic API Key</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Required for AI-powered receipt analysis. Get your key from{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>
              <div className="space-y-3">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={testApiKey}
                  disabled={testing || !apiKey.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                >
                  {testing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Test API Key
                </button>
              </div>
            </div>

            {/* Admin Password Section */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Change Admin Password</h2>
              <p className="text-sm text-gray-500 mb-4">
                Leave blank to keep the current password.
              </p>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="New admin password"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Email Notifications Section */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Email Notifications (SMTP)</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Get notified when receipts are processed. Configure your SMTP server settings below.
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Port
                    </label>
                    <input
                      type="text"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="587"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Username
                    </label>
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="user@gmail.com"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Password
                    </label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="App password or SMTP password"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Address
                  </label>
                  <input
                    type="text"
                    value={smtpFrom}
                    onChange={(e) => setSmtpFrom(e.target.value)}
                    placeholder="Receipts <receipts@yourdomain.com>"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Send Notifications To
                  </label>
                  <input
                    type="email"
                    value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)}
                    placeholder="colin@example.com"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={testEmail}
                  disabled={testingEmail || !smtpHost.trim() || !smtpUser.trim() || !smtpPass.trim() || !smtpFrom.trim() || !notifyEmail.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                >
                  {testingEmail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Send Test Email
                </button>
              </div>
            </div>

            {/* Dropbox Sync Section */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Cloud className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Dropbox Sync</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Automatically sync processed receipts to your Dropbox folder.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dropbox Access Token
                  </label>
                  <input
                    type="password"
                    value={dropboxToken}
                    onChange={(e) => setDropboxToken(e.target.value)}
                    placeholder="sl.u.xxxx..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Get from{' '}
                    <a
                      href="https://www.dropbox.com/developers/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Dropbox Developer Apps
                    </a>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dropbox Folder Path
                  </label>
                  <input
                    type="text"
                    value={dropboxFolder}
                    onChange={(e) => setDropboxFolder(e.target.value)}
                    placeholder="/TGL/Receipts"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Receipts will be saved to: {dropboxFolder || '/TGL/Receipts'}/{'{date}'}/{'{vendor}'}_{'{amount}'}.jpg
                  </p>
                </div>
              </div>
            </div>

            {/* IMAP Inbound Email Section */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Inbox className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Inbound Email (IMAP)</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Poll an IMAP mailbox for forwarded receipt emails. The SMTP server will periodically check this inbox
                for new emails with receipt attachments and process them automatically.
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IMAP Host
                    </label>
                    <input
                      type="text"
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                      placeholder="imap.gmail.com"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IMAP Port
                    </label>
                    <input
                      type="text"
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                      placeholder="993"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IMAP Username
                    </label>
                    <input
                      type="text"
                      value={imapUser}
                      onChange={(e) => setImapUser(e.target.value)}
                      placeholder="receipts@co-l.in"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IMAP Password
                    </label>
                    <input
                      type="password"
                      value={imapPass}
                      onChange={(e) => setImapPass(e.target.value)}
                      placeholder="App password"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mailbox
                    </label>
                    <input
                      type="text"
                      value={imapMailbox}
                      onChange={(e) => setImapMailbox(e.target.value)}
                      placeholder="INBOX"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Folder to monitor (e.g., INBOX, Receipts)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Poll Interval (seconds)
                    </label>
                    <input
                      type="text"
                      value={imapPollInterval}
                      onChange={(e) => setImapPollInterval(e.target.value)}
                      placeholder="60"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      How often to check for new emails (minimum 30)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={testImap}
                    disabled={testingImap || !imapHost.trim() || !imapUser.trim() || !imapPass.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    {testingImap ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Inbox className="w-4 h-4" />
                    )}
                    Test IMAP Connection
                  </button>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Tip:</strong> For Gmail, use an App Password (not your regular password).
                    Go to Google Account &rarr; Security &rarr; 2-Step Verification &rarr; App Passwords.
                    Restart the SMTP process after changing IMAP settings (<code className="bg-blue-100 px-1 rounded">pm2 restart receipts-smtp</code>).
                  </p>
                </div>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div
                className={`flex items-center gap-2 p-4 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                {message.text}
              </div>
            )}

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : null}
              Save Settings
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
