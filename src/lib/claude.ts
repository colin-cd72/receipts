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

  const anthropic = getAnthropicClient()
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          fileContent,
          {
            type: 'text',
            text: `Analyze this receipt and extract the following information. Return your response as a JSON object with these exact fields:

{
  "vendor": "Name of the merchant/vendor",
  "amount": 123.45,
  "currency": "USD",
  "date": "YYYY-MM-DD",
  "category": "One of: ${EXPENSE_CATEGORIES.join(', ')}",
  "description": "Brief description of the purchase",
  "payment_method": "Card type or payment method if visible",
  "raw_text": "All readable text from the receipt"
}

Rules:
- For amount, extract the total/final amount as a number (no currency symbol)
- For date, use ISO format YYYY-MM-DD
- For category, choose the most appropriate from the list provided
- If any field cannot be determined, use null
- Return ONLY the JSON object, no other text`,
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
    return JSON.parse(jsonMatch[0]) as ReceiptAnalysis
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
