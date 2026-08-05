import mongoose, { Schema, type Document } from 'mongoose'

export interface IParkingQueue extends Document {
  plate:        string
  cardType:     'car' | 'motorcycle'
  cardUid?:     string
  joinedAt:     Date
  status:       'waiting' | 'entered' | 'cancelled'
  enteredAt?:   Date
  cancelledAt?: Date
  operatorId?:  string
  shiftId?:     string
}

const ParkingQueueSchema = new Schema<IParkingQueue>({
  plate:       { type: String, required: true },
  cardType:    { type: String, required: true, enum: ['car', 'motorcycle'] },
  cardUid:     { type: String },
  joinedAt:    { type: Date, required: true, default: Date.now },
  status:      { type: String, required: true, enum: ['waiting', 'entered', 'cancelled'], default: 'waiting' },
  enteredAt:   { type: Date },
  cancelledAt: { type: Date },
  operatorId:  { type: String },
  shiftId:     { type: String },
}, { timestamps: true })

ParkingQueueSchema.index({ status: 1, joinedAt: 1 })

export const ParkingQueue =
  mongoose.models.ParkingQueue as mongoose.Model<IParkingQueue> ??
  mongoose.model<IParkingQueue>('ParkingQueue', ParkingQueueSchema)
