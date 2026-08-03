import mongoose, { Schema, type Document } from 'mongoose'

export interface IParkingCard extends Document {
  uid: string
  type: 'car' | 'motorcycle' | 'overnight'
  label: string
  isActive: boolean
  createdAt: Date
}

const ParkingCardSchema = new Schema<IParkingCard>({
  uid:       { type: String, required: true, unique: true, trim: true },
  type:      { type: String, required: true, enum: ['car', 'motorcycle', 'overnight'] },
  label:     { type: String, default: '' },
  isActive:  { type: Boolean, default: true },
}, { timestamps: true })

export const ParkingCard = mongoose.models.ParkingCard as mongoose.Model<IParkingCard>
  ?? mongoose.model<IParkingCard>('ParkingCard', ParkingCardSchema)
