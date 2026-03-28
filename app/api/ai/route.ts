import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt } = await req.json()
    
    const groq = createOpenAI({
      apiKey: process.env.GROQ_API_KEY || '',
      baseURL: 'https://api.groq.com/openai/v1',
      compatibility: 'compatible',
    })

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt || 'You are a helpful assistant.',
      messages,
    })

    return NextResponse.json({ result: text })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
