import mongoose, { Schema, type Document } from 'mongoose'

export interface IParkingCard extends Document {
  uid: string
  type: 'car' | 'motorcycle' | 'overnight'
  cardCategory: 'temporary' | 'monthly'
  label: string
  ownerName: string
  plate: string
  phone: string
  address: string
  idCardPhotoPath?: string
  expiryDate?: Date
  isActive: boolean
  createdAt: Date
}

const ParkingCardSchema = new Schema<IParkingCard>({
  uid:            { type: String, required: true, unique: true, trim: true },
  type:           { type: String, required: true, enum: ['car', 'motorcycle', 'overnight'] },
  cardCategory:   { type: String, required: true, enum: ['temporary', 'monthly'], default: 'temporary' },
  label:          { type: String, default: '' },
  ownerName:      { type: String, default: '' },
  plate:          { type: String, default: '' },
  phone:          { type: String, default: '' },
  address:        { type: String, default: '' },
  idCardPhotoPath: { type: String },
  expiryDate:     { type: Date, default: null },
  isActive:       { type: Boolean, default: true },
}, { timestamps: true })

export const ParkingCard = mongoose.models.ParkingCard as mongoose.Model<IParkingCard>
  ?? mongoose.model<IParkingCard>('ParkingCard', ParkingCardSchema)
