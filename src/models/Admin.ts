import mongoose, { Schema, Document } from 'mongoose'

export interface IAdmin extends Document {
  username:     string
  passwordHash: string
  name:         string
  role:         'superadmin' | 'admin' | 'operator'
  isActive:     boolean
  lastLoginAt?: Date
  createdAt:    Date
}

const AdminSchema = new Schema<IAdmin>({
  username:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name:         { type: String, required: true },
  role:         { type: String, enum: ['superadmin', 'admin', 'operator'], default: 'operator' },
  isActive:     { type: Boolean, default: true },
  lastLoginAt:  { type: Date },
}, { timestamps: true })

export const Admin =
  mongoose.models.Admin ?? mongoose.model<IAdmin>('Admin', AdminSchema)
