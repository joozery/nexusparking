import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { SystemSettings, getSettings } from '@/models/SystemSettings'

export const dynamic = 'force-dynamic'

export async function GET() {
  await connectDB()
  const settings = await getSettings()
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  await connectDB()

  const $set: Record<string, unknown> = {}

  if (body.businessHours) {
    if (body.businessHours.open  !== undefined) $set['businessHours.open']  = body.businessHours.open
    if (body.businessHours.close !== undefined) $set['businessHours.close'] = body.businessHours.close
  }
  if (body.capacity) {
    if (body.capacity.car        !== undefined) $set['capacity.car']        = body.capacity.car
    if (body.capacity.motorcycle !== undefined) $set['capacity.motorcycle'] = body.capacity.motorcycle
  }
  if (body.rates?.car) {
    if (body.rates.car.firstHour !== undefined) $set['rates.car.firstHour'] = body.rates.car.firstHour
    if (body.rates.car.extraHour !== undefined) $set['rates.car.extraHour'] = body.rates.car.extraHour
  }
  if (body.rates?.motorcycle) {
    if (body.rates.motorcycle.firstHour !== undefined) $set['rates.motorcycle.firstHour'] = body.rates.motorcycle.firstHour
    if (body.rates.motorcycle.extraHour !== undefined) $set['rates.motorcycle.extraHour'] = body.rates.motorcycle.extraHour
  }
  if (body.rates?.overnight) {
    for (const k of ['windowStart', 'windowEnd', 'flatRateStart', 'flatRate', 'extraHour'] as const) {
      if (body.rates.overnight[k] !== undefined) $set[`rates.overnight.${k}`] = body.rates.overnight[k]
    }
  }
  if (body.hardware) {
    for (const dev of ['camera', 'barrier', 'reader', 'printer', 'drawer'] as const) {
      if (body.hardware[dev]) {
        for (const f of ['ip', 'port', 'endpoint', 'enabled'] as const) {
          if (body.hardware[dev][f] !== undefined) $set[`hardware.${dev}.${f}`] = body.hardware[dev][f]
        }
      }
    }
    for (const dev of ['cameraEntry', 'cameraExit'] as const) {
      if (body.hardware[dev]) {
        for (const f of ['ip', 'port', 'user', 'pass', 'enabled'] as const) {
          if (body.hardware[dev][f] !== undefined) $set[`hardware.${dev}.${f}`] = body.hardware[dev][f]
        }
      }
    }
  }
  if (body.lostCardFine   !== undefined) $set['lostCardFine']   = body.lostCardFine
  if (body.afterHoursFine !== undefined) $set['afterHoursFine'] = body.afterHoursFine
  if (body.monthlyDeposit !== undefined) $set['monthlyDeposit'] = body.monthlyDeposit
  if (body.monthlyFee     !== undefined) $set['monthlyFee']     = body.monthlyFee
  const updated = await SystemSettings.findOneAndUpdate(
    {},
    { $set },
    { new: true, upsert: true, strict: false },
  )

  // line — ใช้ native collection เพื่อ bypass Mongoose schema cache ระหว่าง hot reload
  if (body.line) {
    await SystemSettings.collection.updateOne(
      {},
      {
        $set: {
          'line.enabled':      body.line.enabled      ?? false,
          'line.channelToken': body.line.channelToken ?? '',
          'line.targets':      body.line.targets      ?? [],
        },
      },
    )
  }

  const fresh = await SystemSettings.findOne().lean()
  return NextResponse.json(fresh)
}
