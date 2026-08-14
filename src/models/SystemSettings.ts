import mongoose, { Schema, type Document } from 'mongoose'

export interface ISystemSettings extends Document {
  businessHours: { open: string; close: string }
  capacity: { car: number; motorcycle: number }
  rates: {
    car:        { firstHour: number; extraHour: number }
    motorcycle: { firstHour: number; extraHour: number }
    overnight:  { windowStart: string; windowEnd: string; flatRateStart: string; flatRate: number; extraHour: number }
  }
  hardware: {
    camera:  { ip: string; port: number; endpoint: string; enabled: boolean }
    barrier: { ip: string; port: number; endpoint: string; enabled: boolean }
    reader:  { ip: string; port: number; endpoint: string; enabled: boolean }
    printer: { ip: string; port: number; endpoint: string; enabled: boolean }
    drawer:  { ip: string; port: number; endpoint: string; enabled: boolean }
  }
  lostCardFine:   number
  afterHoursFine: number
  cctvUrls: { plate: string; face: string; rear: string; exit: string }
}

const hwDevice = {
  ip:       { type: String, default: '' },
  port:     { type: Number, default: 80 },
  endpoint: { type: String, default: '/' },
  enabled:  { type: Boolean, default: false },
}

const SystemSettingsSchema = new Schema<ISystemSettings>({
  businessHours: {
    open:  { type: String, default: '06:30' },
    close: { type: String, default: '22:00' },
  },
  capacity: {
    car:        { type: Number, default: 150 },
    motorcycle: { type: Number, default: 50  },
  },
  rates: {
    car:        { firstHour: { type: Number, default: 30  }, extraHour: { type: Number, default: 20 } },
    motorcycle: { firstHour: { type: Number, default: 20  }, extraHour: { type: Number, default: 10 } },
    overnight:  { windowStart: { type: String, default: '18:00' }, windowEnd: { type: String, default: '07:00' }, flatRateStart: { type: String, default: '22:00' }, flatRate: { type: Number, default: 100 }, extraHour: { type: Number, default: 20 } },
  },
  hardware: {
    camera:  hwDevice,
    barrier: hwDevice,
    reader:  hwDevice,
    printer: hwDevice,
    drawer:  hwDevice,
  },
  lostCardFine:   { type: Number, default: 300 },
  afterHoursFine: { type: Number, default: 300 },
  cctvUrls: {
    plate: { type: String, default: '' },
    face:  { type: String, default: '' },
    rear:  { type: String, default: '' },
    exit:  { type: String, default: '' },
  },
}, { timestamps: true })

export const SystemSettings = mongoose.models.SystemSettings as mongoose.Model<ISystemSettings>
  ?? mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema)

// ดึง settings (สร้าง default ถ้ายังไม่มี)
export async function getSettings(): Promise<ISystemSettings> {
  let settings = await SystemSettings.findOne()
  if (!settings) {
    settings = await SystemSettings.create({})
  }
  return settings
}
