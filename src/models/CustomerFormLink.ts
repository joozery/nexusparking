import mongoose, { Schema, type Document } from 'mongoose'

export interface ICustomerFormLink extends Document {
  kind: 'lost' | 'return'
  slug: string
  createdBy?: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const CustomerFormLinkSchema = new Schema<ICustomerFormLink>({
  kind: { type: String, enum: ['lost', 'return'], default: 'lost', index: true },
  slug: { type: String, required: true, unique: true, index: true },
  createdBy: { type: String },
  active: { type: Boolean, default: true },
}, { timestamps: true })

export const CustomerFormLink = mongoose.models.CustomerFormLink as mongoose.Model<ICustomerFormLink>
  ?? mongoose.model<ICustomerFormLink>('CustomerFormLink', CustomerFormLinkSchema)
