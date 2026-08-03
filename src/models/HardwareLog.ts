import mongoose, { Schema, Document } from 'mongoose'

export interface IHardwareLog extends Document {
  device:    string
  event:     string
  success:   boolean
  ip:        string
  latencyMs: number
  error?:    string
  createdAt: Date
}

const HardwareLogSchema = new Schema<IHardwareLog>({
  device:    { type: String, required: true, index: true },
  event:     { type: String, default: 'trigger' },
  success:   { type: Boolean, required: true },
  ip:        { type: String, default: '' },
  latencyMs: { type: Number, default: 0 },
  error:     { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } })

HardwareLogSchema.index({ createdAt: -1 })

export const HardwareLog =
  mongoose.models.HardwareLog ??
  mongoose.model<IHardwareLog>('HardwareLog', HardwareLogSchema)
