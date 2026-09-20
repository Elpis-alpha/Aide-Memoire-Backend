import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose'

export interface ITag {
  name: string
  createdAt: Date
  updatedAt: Date
}

export type TagDocument = HydratedDocument<ITag>
export type TagModel = Model<ITag>

const tagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 60 },
  },
  { timestamps: true },
)

// `unique: true` on the field already creates the index that the prefix
// lookup in tag search uses; declaring it again here made Mongoose warn.

export const Tag = (mongoose.models.Tag as TagModel) ?? model<ITag>('Tag', tagSchema)
