import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json({ 
    hasKey: !!process.env.GROQ_API_KEY,
    keyPrefix: process.env.GROQ_API_KEY?.slice(0, 8) || 'EMPTY'
  })
}