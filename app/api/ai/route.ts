import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt } = await req.json()
    
    const groq = createOpenAI({
      apiKey: apiKey: process.env.GROQ_API_KEY || '',
      baseURL: 'https://api.groq.com/openai/v1',
      compatibility: 'compatible',
    })

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt || "You are a helpful assistant. Always respond in the same language the user writes in.",
      messages,
    })

    return NextResponse.json({ result: text })

  } catch (error: any) {
    console.error('【报错详情】:', JSON.stringify(error, null, 2))
    return NextResponse.json(
      { error: `AI Error: ${error.message || 'Not Found'}` },
      { status: 500 }
    )
  }
}