import mongoose, { Schema, type Document } from 'mongoose'

export interface IShift extends Document {
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
  openingFloat:    number   // เงินต้นกะ (รับจาก till ตอนเริ่ม)
  closingFloat:    number   // เงินส่ง till ตอนปิดกะ
  carryoverCars:   number   // รถค้างในลานตอนเริ่มกะ
  closingCarCount: number   // รถค้างในลานตอนปิดกะ
}

const ShiftSchema = new Schema<IShift>({
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
  openingFloat:    { type: Number, default: 0 },
  closingFloat:    { type: Number, default: 0 },
  carryoverCars:   { type: Number, default: 0 },
  closingCarCount: { type: Number, default: 0 },
}, { timestamps: true })

ShiftSchema.index({ operatorId: 1, status: 1 })

export const Shift = mongoose.models.Shift as mongoose.Model<IShift>
  ?? mongoose.model<IShift>('Shift', ShiftSchema)
