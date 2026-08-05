import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { SystemSettings, getSettings } from '@/models/SystemSettings'

export async function GET() {
  await connectDB()
  const settings = await getSettings()
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  await connectDB()

  let settings = await SystemSettings.findOne()
  if (!settings) {
    settings = await SystemSettings.create(body)
  } else {
    // deep merge
    if (body.businessHours) Object.assign(settings.businessHours, body.businessHours)
    if (body.capacity) {
      Object.assign(settings.capacity, body.capacity)
      settings.markModified('capacity')
    }
    if (body.rates) {
      if (body.rates.car)        Object.assign(settings.rates.car,        body.rates.car)
      if (body.rates.motorcycle) Object.assign(settings.rates.motorcycle, body.rates.motorcycle)
      if (body.rates.overnight)  Object.assign(settings.rates.overnight,  body.rates.overnight)
    }
    if (body.hardware) {
      for (const key of ['camera', 'barrier', 'reader', 'printer', 'drawer'] as const) {
        if (body.hardware[key]) Object.assign(settings.hardware[key], body.hardware[key])
      }
    }
    if (body.lostCardFine !== undefined) settings.lostCardFine = body.lostCardFine
    settings.markModified('rates')
    settings.markModified('hardware')
    settings.markModified('businessHours')
    await settings.save()
  }

  return NextResponse.json(settings)
}
