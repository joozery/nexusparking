import mongoose, { Schema, type Document } from 'mongoose'

export interface IFine extends Document {
  name:         string
  fineType:     'after_hours'
  amount:       number
  isActive:     boolean
  description?: string
}

const FineSchema = new Schema<IFine>({
  name:        { type: String, required: true },
  fineType:    { type: String, required: true, enum: ['after_hours'] },
  amount:      { type: Number, required: true, min: 0 },
  isActive:    { type: Boolean, default: true },
  description: { type: String },
}, { timestamps: true })

export const Fine =
  mongoose.models.Fine as mongoose.Model<IFine> ??
  mongoose.model<IFine>('Fine', FineSchema)
