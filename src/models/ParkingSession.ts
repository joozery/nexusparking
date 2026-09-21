import mongoose, { Schema, type Document } from 'mongoose'

export interface IParkingSession extends Document {
  cardUid:       string
  cardType:      'car' | 'motorcycle' | 'overnight'
  plate:         string        // last 4 digits
  entryTime:     Date
  exitTime?:     Date
  durationMin:   number        // minutes (updated on checkout)
  fee:           number        // parking fee
  lostFine:      number        // 0 or 300
  lostCard?:     boolean
  totalFee:      number        // fee + lostFine
  status:        'active' | 'completed' | 'lost' | 'void'
  paymentMethod:  'cash' | 'qr'
  operatorId?:    string
  shiftId?:       string
  discountId?:    string
  discountName?:  string
  discountAmount: number
  fineId?:        string
  fineName?:      string
  fineAmount:     number
  note?:          string
  isSimulated?:   boolean
  entryPhotoPath?: string
  exitPhotoPath?:  string
  entryCamPlate?:  string
  entryCamFace?:   string
  entryCamRear?:   string
  entryCamExit?:   string
}

const ParkingSessionSchema = new Schema<IParkingSession>({
  cardUid:     { type: String, required: true },
  cardType:    { type: String, required: true, enum: ['car', 'motorcycle', 'overnight'] },
  plate:       { type: String, required: true },
  entryTime:   { type: Date, required: true },
  exitTime:    { type: Date },
  durationMin: { type: Number, default: 0 },
  fee:         { type: Number, default: 0 },
  lostFine:    { type: Number, default: 0 },
  lostCard:    { type: Boolean },
  totalFee:    { type: Number, default: 0 },
  status:         { type: String, required: true, enum: ['active', 'completed', 'lost', 'void'], default: 'active' },
  paymentMethod:  { type: String, enum: ['cash', 'qr'], default: 'cash' },
  operatorId:     { type: String },
  shiftId:        { type: String },
  discountId:     { type: String },
  discountName:   { type: String },
  discountAmount: { type: Number, default: 0 },
  fineId:         { type: String },
  fineName:       { type: String },
  fineAmount:     { type: Number, default: 0 },
  note:           { type: String },
  isSimulated:    { type: Boolean, default: false },
  entryPhotoPath: { type: String },
  exitPhotoPath:  { type: String },
  entryCamPlate:  { type: String },
  entryCamFace:   { type: String },
  entryCamRear:   { type: String },
  entryCamExit:   { type: String },
}, { timestamps: true })

ParkingSessionSchema.index({ status: 1, entryTime: -1 })
ParkingSessionSchema.index({ cardUid: 1, status: 1 })
ParkingSessionSchema.index({ cardUid: 1 }, { name: 'one_active_session_per_card', unique: true, partialFilterExpression: { status: 'active' } })

export const ParkingSession = mongoose.models.ParkingSession as mongoose.Model<IParkingSession>
  ?? mongoose.model<IParkingSession>('ParkingSession', ParkingSessionSchema)
