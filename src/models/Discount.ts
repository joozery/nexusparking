import mongoose, { Schema, type Document } from 'mongoose'

export interface IDiscount extends Document {
  name:          string
  discountType:  'fixed' | 'percent'
  discountValue: number   // บาท หรือ %
  maxDiscount?:  number   // cap สำหรับ percent (optional)
  isActive:      boolean
  description?:  string
}

const DiscountSchema = new Schema<IDiscount>({
  name:          { type: String, required: true },
  discountType:  { type: String, required: true, enum: ['fixed', 'percent'] },
  discountValue: { type: Number, required: true, min: 0 },
  maxDiscount:   { type: Number },
  isActive:      { type: Boolean, default: true },
  description:   { type: String },
}, { timestamps: true })

export const Discount =
  mongoose.models.Discount as mongoose.Model<IDiscount> ??
  mongoose.model<IDiscount>('Discount', DiscountSchema)
