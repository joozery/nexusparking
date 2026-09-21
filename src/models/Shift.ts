import mongoose, { Schema, type Document } from 'mongoose'

import type { ShiftVehicleCounts } from '@/lib/shiftVehicleCounts'
export interface IShift extends Document, ShiftVehicleCounts {
  cardRefunds?: { sessionId: string; cardUid: string; plate: string; amount: number; paymentMethod: 'cash' | 'qr'; refundedAt: Date; operatorId: string }[]
  operatorId:      string
  operatorName:    string
  startTime:       Date
  endTime?:        Date
  status:          'active' | 'closed'
  checkinsCount:   number
  checkoutsCount:  number
  cashAmount:      number
  qrAmount:        number
  totalAmount:     number
  openingFloat:      number   // เงินต้นกะ (รับจาก till ตอนเริ่ม)
  closingFloat:      number   // เงินส่ง till ตอนปิดกะ
  openingBreakdown:  Map<string, number>  // จำนวนแบงก์/เหรียญที่นับตอนเริ่มกะ — key คือชนิดเงิน เช่น "1000","500",...,"1"
  closingBreakdown:  Map<string, number>  // จำนวนแบงก์/เหรียญที่นับตอนปิดกะ
  carryoverCars:     number   // รถค้างในลานตอนเริ่มกะ
  closingCarCount:   number   // รถค้างในลานตอนปิดกะ
}

const countsSchema = new Schema({ car: { type: Number, required: true }, motorcycle: { type: Number, required: true } }, { _id: false })
const ShiftSchema = new Schema<IShift>({
  cardRefunds: { type: [{ sessionId: String, cardUid: String, plate: String, amount: Number, paymentMethod: { type: String, enum: ['cash', 'qr'] }, refundedAt: Date, operatorId: String }], default: [] },
  checkinsByType: { type: countsSchema, default: undefined },
  checkoutsByType: { type: countsSchema, default: undefined },
  carryoverByType: { type: countsSchema, default: undefined },
  closingByType: { type: countsSchema, default: undefined },
  operatorId:      { type: String, required: true },
  operatorName:    { type: String, required: true },
  startTime:       { type: Date,   required: true },
  endTime:         { type: Date },
  status:          { type: String, required: true, enum: ['active', 'closed'], default: 'active' },
  checkinsCount:   { type: Number, default: 0 },
  checkoutsCount:  { type: Number, default: 0 },
  cashAmount:      { type: Number, default: 0 },
  qrAmount:        { type: Number, default: 0 },
  totalAmount:     { type: Number, default: 0 },
  openingFloat:     { type: Number, default: 0 },
  closingFloat:     { type: Number, default: 0 },
  openingBreakdown: { type: Map, of: Number, default: {} },
  closingBreakdown: { type: Map, of: Number, default: {} },
  carryoverCars:    { type: Number, default: 0 },
  closingCarCount:  { type: Number, default: 0 },
}, { timestamps: true })

ShiftSchema.index({ operatorId: 1, status: 1 })
ShiftSchema.index({ 'cardRefunds.sessionId': 1 })

export const Shift = mongoose.models.Shift as mongoose.Model<IShift>
  ?? mongoose.model<IShift>('Shift', ShiftSchema)
