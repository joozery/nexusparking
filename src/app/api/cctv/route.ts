import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { SystemSettings } from '@/models/SystemSettings'

export async function GET() {
  await connectDB()
  const s = await SystemSettings.findOne().select('cctvUrls')
  return NextResponse.json(s?.cctvUrls ?? { plate: '', face: '', rear: '', exit: '' })
}

export async function POST(req: NextRequest) {
  await connectDB()
  const body = await req.json()
  const urls = {
    plate: body.plate ?? '',
    face:  body.face  ?? '',
    rear:  body.rear  ?? '',
    exit:  body.exit  ?? '',
  }
  await SystemSettings.updateOne({}, { $set: { cctvUrls: urls } }, { upsert: true })
  return NextResponse.json({ ok: true })
}
