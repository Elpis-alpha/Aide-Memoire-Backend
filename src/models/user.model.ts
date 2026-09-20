import mongoose, { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose'
import bcrypt from 'bcryptjs'

/** S3-14 — was 8. 12 is the current sensible floor for bcrypt. */
export const BCRYPT_ROUNDS = 12

export interface IUser {
  name: string
  email: string
  biography?: string
  password: string
  noteName: string
  noteSections: Types.ObjectId[]
  noteTags: Types.ObjectId[]
  /**
   * S1-01 — replaces the old `verify: String` field, whose `default: v4()` was
   * evaluated once per process and therefore shared by every user registered
   * during it. Verification state is now a timestamp; the token that proves it
   * lives hashed with an expiry and is cleared on use.
   */
  emailVerifiedAt: Date | null
  verificationTokenHash: string | null
  verificationTokenExpiresAt: Date | null
  /** Refresh tokens minted before this instant are rejected (S1-08). */
  passwordChangedAt: Date | null
  avatarUrl: string | null
  avatarPublicId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>
}

export interface UserModel extends Model<IUser, {}, IUserMethods> {
  findByCredentials(email: string, password: string): Promise<UserDocument | null>
}

export type UserDocument = HydratedDocument<IUser, IUserMethods>

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      // Format is enforced by zod at the boundary; the index enforces uniqueness.
    },
    biography: { type: String, trim: true, maxlength: 2000 },
    // Never returned by a query unless explicitly selected, so a stray
    // `res.send(user)` cannot leak the hash.
    password: { type: String, required: true, select: false },
    noteName: { type: String, required: true, trim: true, default: 'New Note' },
    noteSections: [{ type: Schema.Types.ObjectId, ref: 'Section' }],
    noteTags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
    emailVerifiedAt: { type: Date, default: null },
    verificationTokenHash: { type: String, default: null, select: false },
    verificationTokenExpiresAt: { type: Date, default: null, select: false },
    passwordChangedAt: { type: Date, default: null },
    avatarUrl: { type: String, default: null },
    avatarPublicId: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).password
        delete (ret as Record<string, unknown>).verificationTokenHash
        delete (ret as Record<string, unknown>).verificationTokenExpiresAt
        delete (ret as Record<string, unknown>).__v
        // Keep the old boolean on the wire so the frontend contract is stable
        // while the field underneath becomes a timestamp.
        ;(ret as Record<string, unknown>).verified = Boolean(ret.emailVerifiedAt)
        return ret
      },
    },
  },
)

// Lookup by verification token during email confirmation.
userSchema.index({ verificationTokenHash: 1 }, { sparse: true })

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS)
  if (!this.isNew) this.passwordChangedAt = new Date()
  next()
})

userSchema.methods.comparePassword = function comparePassword(candidate: string) {
  return bcrypt.compare(candidate, this.password)
}

/**
 * Returns null rather than throwing so the caller decides the response. It
 * always runs a bcrypt comparison, including for an unknown address, so the
 * response time does not reveal whether the account exists.
 */
userSchema.statics.findByCredentials = async function findByCredentials(
  email: string,
  password: string,
) {
  const user = await this.findOne({ email: email.toLowerCase().trim() }).select('+password')
  if (!user) {
    await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv')
    return null
  }
  const matches = await user.comparePassword(password)
  return matches ? user : null
}

export const User = (mongoose.models.User as UserModel) ?? model<IUser, UserModel>('User', userSchema)
