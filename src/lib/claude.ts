import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

function getAnthropicClient(): Anthropic {
  // Read API key fresh from env (allows runtime updates)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured. Go to /admin/settings to set it.')
  }
  return new Anthropic({ apiKey })
}

export interface ReceiptAnalysis {
  vendor: string | null
  amount: number | null
  currency: string
  date: string | null
  category: string | null
  description: string | null
  payment_method: string | null
  raw_text: string | null
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

export async function analyzeReceipt(filePath: string): Promise<ReceiptAnalysis> {
  const absolutePath = path.join(process.cwd(), 'data', 'uploads', filePath)
  const ext = path.extname(filePath).toLowerCase()

  const fileData = fs.readFileSync(absolutePath)

  // Check file size (max ~20MB for base64)
  if (fileData.length > 15 * 1024 * 1024) {
    return {
      vendor: null,
      amount: null,
      currency: 'USD',
      date: null,
      category: null,
      description: null,
      payment_method: null,
      raw_text: 'File too large for processing - please upload a smaller file',
    }
  }

  const base64Data = fileData.toString('base64')

  // Build the content block based on file type
  let fileContent: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam

  if (ext === '.pdf') {
    // Use Claude's native PDF support
    fileContent = {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64Data,
      },
    }
  } else {
    // Handle images
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
    if (ext === '.png') mediaType = 'image/png'
    else if (ext === '.gif') mediaType = 'image/gif'
    else if (ext === '.webp') mediaType = 'image/webp'

    fileContent = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64Data,
      },
    }
  }

  // Get current date for context
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const todayStr = today.toISOString().split('T')[0]

  const anthropic = getAnthropicClient()
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          fileContent,
          {
            type: 'text',
            text: `You are an expert receipt analyzer. Today's date is ${todayStr}. Carefully analyze this receipt image/document and extract the following information.

Return your response as a JSON object with these exact fields:

{
  "vendor": "Name of the merchant/vendor/business",
  "amount": 123.45,
  "currency": "USD",
  "date": "YYYY-MM-DD",
  "category": "Category from list below",
  "description": "Brief description of the purchase",
  "payment_method": "Card type or payment method if visible",
  "raw_text": "Key text from the receipt"
}

CRITICAL DATE RULES:
- Look for the transaction date, NOT the print date or expiration date
- Common date formats: MM/DD/YY, MM/DD/YYYY, DD-Mon-YYYY, Month DD, YYYY
- If only MM/DD is shown (no year), assume ${currentYear} if the month is <= ${currentMonth}, otherwise assume ${currentYear - 1}
- If date shows 2-digit year (e.g., 01/15/25), expand to full year (2025)
- The date should be when the purchase was made
- Output format MUST be YYYY-MM-DD (e.g., 2025-01-15)

AMOUNT RULES:
- Extract the TOTAL or GRAND TOTAL amount (after tax)
- Look for "Total", "Amount Due", "Grand Total", "Balance Due"
- Return as a number without currency symbols (e.g., 42.50 not "$42.50")
- If multiple totals shown, use the final/largest total

VENDOR RULES:
- Use the business name at the top of the receipt
- Clean up the name (e.g., "WALMART STORE #1234" → "Walmart")
- For restaurants, use the restaurant name not "Square" or payment processor

CATEGORY - Choose the most appropriate:
${EXPENSE_CATEGORIES.map(c => `- ${c}`).join('\n')}

If a field cannot be determined with confidence, use null.
Return ONLY the JSON object, no explanation or other text.`,
          },
        ],
      },
    ],
  })

  // Extract the text response
  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse the JSON response
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    const result = JSON.parse(jsonMatch[0]) as ReceiptAnalysis

    // Validate and fix date format
    if (result.date) {
      result.date = normalizeDate(result.date, currentYear)
    }

    // Validate amount is a number
    if (result.amount !== null && typeof result.amount !== 'number') {
      const parsed = parseFloat(String(result.amount).replace(/[$,]/g, ''))
      result.amount = isNaN(parsed) ? null : parsed
    }

    // Ensure currency defaults to USD
    if (!result.currency) {
      result.currency = 'USD'
    }

    return result
  } catch {
    console.error('Failed to parse Claude response:', textBlock.text)
    return {
      vendor: null,
      amount: null,
      currency: 'USD',
      date: null,
      category: null,
      description: null,
      payment_method: null,
      raw_text: textBlock.text,
    }
  }
}

// Helper function to normalize date formats to YYYY-MM-DD
function normalizeDate(dateStr: string, currentYear: number): string | null {
  if (!dateStr) return null

  // Already in correct format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  // Try various formats
  const formats = [
    // MM/DD/YYYY or MM-DD-YYYY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
    // MM/DD/YY or MM-DD-YY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,
    // YYYY/MM/DD
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
  ]

  // MM/DD/YYYY or MM-DD-YYYY
  let match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (match) {
    const [, month, day, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // MM/DD/YY or MM-DD-YY
  match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
  if (match) {
    const [, month, day, shortYear] = match
    const year = parseInt(shortYear) > 50 ? `19${shortYear}` : `20${shortYear}`
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // YYYY/MM/DD
  match = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (match) {
    const [, year, month, day] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // Month DD, YYYY (e.g., "January 15, 2025")
  match = dateStr.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (match) {
    const [, monthName, day, year] = match
    const monthNum = getMonthNumber(monthName)
    if (monthNum) {
      return `${year}-${monthNum.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
  }

  // DD Mon YYYY (e.g., "15 Jan 2025")
  match = dateStr.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (match) {
    const [, day, monthName, year] = match
    const monthNum = getMonthNumber(monthName)
    if (monthNum) {
      return `${year}-${monthNum.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
  }

  // If we can't parse it, return null
  console.warn('Could not parse date:', dateStr)
  return null
}

function getMonthNumber(monthName: string): string | null {
  const months: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  }
  return months[monthName.toLowerCase()] || null
}
