import mongoose, { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose'

export interface ISection {
  owner: Types.ObjectId
  name: string
  description: string
  isPublic: boolean
  open: boolean
  canDelete: boolean
  createdAt: Date
  updatedAt: Date
}

export type SectionDocument = HydratedDocument<ISection>
export type SectionModel = Model<ISection>

const sectionSchema = new Schema<ISection>(
  {
    owner: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    isPublic: { type: Boolean, default: false },
    open: { type: Boolean, default: true },
    canDelete: { type: Boolean, default: true },
  },
  { timestamps: true },
)

// S2-14 — sections also had only `_id`.
sectionSchema.index({ owner: 1, name: 1 })
sectionSchema.index({ owner: 1, updatedAt: -1 })
sectionSchema.index({ isPublic: 1 })

export const Section =
  (mongoose.models.Section as SectionModel) ?? model<ISection>('Section', sectionSchema)
