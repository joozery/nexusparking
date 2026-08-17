import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { SystemSettings } from '@/models/SystemSettings'

export async function GET() {
  try {
    await connectDB()
    const s = await SystemSettings.findOne().select('cctvUrls').lean()
    const c = s?.cctvUrls as Record<string, string> | undefined
    return NextResponse.json({
      plate:    c?.plate    ?? '',
      face:     c?.face     ?? '',
      rear:     c?.rear     ?? '',
      exit:     c?.exit     ?? '',
      plateOut: c?.plateOut ?? '',
      faceOut:  c?.faceOut  ?? '',
    })
  } catch (err) {
    console.error('[cctv GET]', err)
    return NextResponse.json({ plate: '', face: '', rear: '', exit: '' })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const urls = {
      plate:    body.plate    ?? '',
      face:     body.face     ?? '',
      rear:     body.rear     ?? '',
      exit:     body.exit     ?? '',
      plateOut: body.plateOut ?? '',
      faceOut:  body.faceOut  ?? '',
    }
    await SystemSettings.updateOne({}, { $set: { cctvUrls: urls } }, { upsert: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cctv POST]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
