import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()
    
    const res = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY || ''}`,
          'Content-Type': 'application/json',
          'x-wait-for-model': 'true',
        },
        body: JSON.stringify({ inputs: prompt }),
      }
    )
    
    console.log('HF status:', res.status, 'type:', res.headers.get('content-type'))
    const buffer = await res.arrayBuffer()
    console.log('size:', buffer.byteLength)
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:image/jpeg;base64,${base64}`
    return NextResponse.json({ url: dataUrl })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}