import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    const anthropic = new Anthropic({
      apiKey: apiKey.trim(),
    })

    // Make a minimal API call to verify the key works
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'Say "OK" and nothing else.',
        },
      ],
    })

    return NextResponse.json({
      success: true,
      model: response.model,
    })
  } catch (error: unknown) {
    console.error('API key test error:', error)

    const apiError = error as { status?: number; message?: string }

    if (apiError.status === 401) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 400 })
    }

    if (apiError.status === 403) {
      return NextResponse.json({ error: 'API key does not have permission' }, { status: 400 })
    }

    return NextResponse.json(
      { error: apiError.message || 'Failed to test API key' },
      { status: 500 }
    )
  }
}
