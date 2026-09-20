import mongoose, { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose'

export interface INote {
  owner: Types.ObjectId
  name: string
  description: string
  text: string
  /**
   * S2-15 — these were untyped arrays of `{_id, name}` copies, so renaming a
   * section left stale names embedded in every note and deleting one left
   * dangling entries. References only; names are resolved by `$lookup`.
   */
  sections: Types.ObjectId[]
  tags: Types.ObjectId[]
  canDelete: boolean
  isPublic: boolean
  specialName: string
  createdAt: Date
  updatedAt: Date
}

export type NoteDocument = HydratedDocument<INote>
export type NoteModel = Model<INote>

const noteSchema = new Schema<INote>(
  {
    owner: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    /**
     * Defaulted, not required. Mongoose treats an empty string as a missing
     * value for `required`, so `required: true` made an empty note impossible
     * to create — while the zod layer above it defaults `text` to `''` and
     * advertises it as optional. The two disagreed, and the frontend's
     * "create the note first, write into it after" flow (S3-35) is exactly
     * the case that hits it.
     */
    text: { type: String, default: '' },
    sections: [{ type: Schema.Types.ObjectId, ref: 'Section' }],
    tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
    canDelete: { type: Boolean, default: true },
    isPublic: { type: Boolean, default: false },
    specialName: { type: String, required: true, default: 'normal', trim: true },
  },
  { timestamps: true },
)

// S2-14 — the collection previously carried only `_id`, so every one of these
// access patterns was a full scan.
noteSchema.index({ owner: 1, updatedAt: -1 })
noteSchema.index({ owner: 1, specialName: 1 })
noteSchema.index({ owner: 1, sections: 1 })
noteSchema.index({ owner: 1, tags: 1 })
// Public reads are filtered on isPublic first, so it leads these two.
noteSchema.index({ isPublic: 1, sections: 1 })
noteSchema.index({ isPublic: 1, updatedAt: -1 })
// S1-09 — replaces the unescaped `new RegExp(userInput)` search.
noteSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 10, description: 2 }, name: 'note_search' },
)

export const Note = (mongoose.models.Note as NoteModel) ?? model<INote>('Note', noteSchema)
