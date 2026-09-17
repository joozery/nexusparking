import mongoose, { Schema, type Document } from 'mongoose'

export interface IFine extends Document {
  name:         string
  amount:       number
  isActive:     boolean
  description?: string
}

const FineSchema = new Schema<IFine>({
  name:        { type: String, required: true },
  amount:      { type: Number, required: true, min: 0 },
  isActive:    { type: Boolean, default: true },
  description: { type: String },
}, { timestamps: true })

export const Fine =
  mongoose.models.Fine as mongoose.Model<IFine> ??
  mongoose.model<IFine>('Fine', FineSchema)
