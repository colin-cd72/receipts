import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { pdf } from 'pdf-to-img'

function getAnthropicClient(): Anthropic {
  // Read API key fresh from env (allows runtime updates)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured. Go to /admin/settings to set it.')
  }
  return new Anthropic({ apiKey })
}

async function convertPdfToImage(pdfPath: string): Promise<Buffer | null> {
  try {
    const document = await pdf(pdfPath, { scale: 2.0 })

    // Get the first page as PNG
    for await (const image of document) {
      return image as Buffer
    }
    return null
  } catch (error) {
    console.error('PDF conversion error:', error)
    return null
  }
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

  let imageData: Buffer
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png'

  // Handle PDF files by converting to image
  if (ext === '.pdf') {
    const pdfImage = await convertPdfToImage(absolutePath)
    if (!pdfImage) {
      return {
        vendor: null,
        amount: null,
        currency: 'USD',
        date: null,
        category: null,
        description: null,
        payment_method: null,
        raw_text: 'Failed to convert PDF for processing',
      }
    }
    imageData = pdfImage
    mediaType = 'image/png'
  } else {
    imageData = fs.readFileSync(absolutePath)

    // Determine media type from extension
    if (ext === '.png') mediaType = 'image/png'
    else if (ext === '.gif') mediaType = 'image/gif'
    else if (ext === '.webp') mediaType = 'image/webp'
    else mediaType = 'image/jpeg'
  }

  // Check file size (max ~20MB for base64)
  if (imageData.length > 15 * 1024 * 1024) {
    return {
      vendor: null,
      amount: null,
      currency: 'USD',
      date: null,
      category: null,
      description: null,
      payment_method: null,
      raw_text: 'Image too large for processing - please upload a smaller image',
    }
  }

  const base64Image = imageData.toString('base64')

  const anthropic = getAnthropicClient()
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `Analyze this receipt image and extract the following information. Return your response as a JSON object with these exact fields:

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
