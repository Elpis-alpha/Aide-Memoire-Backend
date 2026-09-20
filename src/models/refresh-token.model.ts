import mongoose, { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose'

/**
 * S1-07 — the old design kept an unbounded array of raw, non-expiring JWTs on
 * the user document, so a leaked database read handed over working sessions
 * forever. Tokens are stored hashed, expire on their own via a TTL index, and
 * rotate on every use.
 */
export interface IRefreshToken {
  user: Types.ObjectId
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
  /** Set when this token was rotated, so reuse of an old one is detectable. */
  replacedByHash: string | null
  createdAt: Date
  updatedAt: Date
}

export type RefreshTokenDocument = HydratedDocument<IRefreshToken>
export type RefreshTokenModel = Model<IRefreshToken>

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
  },
  { timestamps: true },
)

refreshTokenSchema.index({ user: 1 })
// Mongo removes the document once it expires — no cleanup job to maintain.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const RefreshToken =
  (mongoose.models.RefreshToken as RefreshTokenModel) ??
  model<IRefreshToken>('RefreshToken', refreshTokenSchema)
