import mongoose, { Schema, type Document } from 'mongoose'

export interface ICustomerRegistration extends Document {
  kind: 'lost' | 'return'
  refCode: string
  linkSlug: string
  fullName: string
  phone: string
  bankName?: string
  accountName?: string
  accountNumber?: string
  firstName?: string
  lastName?: string
  idNumber?: string
  vehicleType?: string
  plate?: string
  province?: string
  vehicleBrand?: string
  vehicleModel?: string
  vehicleColor?: string
  entryDate?: string
  consentAccepted?: boolean
  privacyAccepted?: boolean
  privacyAcceptedAt?: Date
  idCardPhotoPath?: string
  vehicleRegistrationPhotoPath?: string
  vehiclePhotoPath?: string
  verifiedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const CustomerRegistrationSchema = new Schema<ICustomerRegistration>({
  kind: { type: String, enum: ['lost', 'return'], default: 'lost', index: true },
  refCode: { type: String, required: true, unique: true, index: true },
  linkSlug: { type: String, required: true, index: true },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  bankName: { type: String, trim: true, maxlength: 80 },
  accountName: { type: String, trim: true, maxlength: 120 },
  accountNumber: { type: String, trim: true, maxlength: 30 },
  firstName: { type: String, trim: true, maxlength: 60 },
  lastName: { type: String, trim: true, maxlength: 60 },
  idNumber: { type: String, trim: true, maxlength: 30 },
  vehicleType: { type: String, trim: true, maxlength: 40 },
  plate: { type: String, trim: true, maxlength: 30 },
  province: { type: String, trim: true, maxlength: 60 },
  vehicleBrand: { type: String, trim: true, maxlength: 60 },
  vehicleModel: { type: String, trim: true, maxlength: 60 },
  vehicleColor: { type: String, trim: true, maxlength: 30 },
  entryDate: { type: String, trim: true, maxlength: 20 },
  consentAccepted: { type: Boolean, default: false },
  privacyAccepted: { type: Boolean, default: false },
  privacyAcceptedAt: { type: Date },
  idCardPhotoPath: { type: String },
  vehicleRegistrationPhotoPath: { type: String },
  vehiclePhotoPath: { type: String },
  verifiedAt: { type: Date },
}, { timestamps: true })

export const CustomerRegistration = mongoose.models.CustomerRegistration as mongoose.Model<ICustomerRegistration>
  ?? mongoose.model<ICustomerRegistration>('CustomerRegistration', CustomerRegistrationSchema)
