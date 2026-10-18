import mongoose, { Schema, type Document } from 'mongoose'

export interface ICustomerRegistration extends Document {
  kind: 'lost' | 'return'
  refCode: string
  linkSlug: string
  fullName: string
  phone: string
  idCardPhotoPath: string
  vehicleRegistrationPhotoPath: string
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
  idCardPhotoPath: { type: String, required: true },
  vehicleRegistrationPhotoPath: { type: String, required: true },
  verifiedAt: { type: Date },
}, { timestamps: true })

export const CustomerRegistration = mongoose.models.CustomerRegistration as mongoose.Model<ICustomerRegistration>
  ?? mongoose.model<ICustomerRegistration>('CustomerRegistration', CustomerRegistrationSchema)
