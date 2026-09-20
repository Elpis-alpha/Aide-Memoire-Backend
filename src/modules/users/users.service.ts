import mongoose, { type Types } from 'mongoose'
import { AppError } from '../../lib/errors'
import { logger } from '../../lib/logger'
import { User, type UserDocument } from '../../models/user.model'
import { Note } from '../../models/note.model'
import { Section } from '../../models/section.model'
import { RefreshToken } from '../../models/refresh-token.model'
import { sendMail } from '../../mail/mailer'
import { exitMail } from '../../mail/mail-templates'
import { env } from '../../config/env'
import type { UpdateProfileInput } from './users.schemas'

/** The subset of a user that is safe to expose to anyone (S1-02). */
export const toPublicProfile = (user: UserDocument) => ({
  _id: user._id,
  name: user.name,
  biography: user.biography ?? '',
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt,
})

export const updateProfile = async (
  user: UserDocument,
  input: UpdateProfileInput,
): Promise<UserDocument> => {
  Object.assign(user, input)
  await user.save()
  return user
}

/**
 * S2-10 — deletion used to be four sequential awaits with no transaction, so a
 * failure part way through left a user with no notes, or notes with no user.
 * All four collections now commit together or not at all.
 */
export const deleteAccount = async (userId: Types.ObjectId, email: string, name: string): Promise<void> => {
  const session = await mongoose.startSession()

  try {
    await session.withTransaction(async () => {
      await Note.deleteMany({ owner: userId }, { session })
      await Section.deleteMany({ owner: userId }, { session })
      await RefreshToken.deleteMany({ user: userId }, { session })
      const result = await User.deleteOne({ _id: userId }, { session })
      if (result.deletedCount === 0) throw AppError.notFound('That account no longer exists')
    })
  } finally {
    await session.endSession()
  }

  // Sent only after the data is actually gone, and never allowed to fail the
  // request — the account is deleted either way.
  const result = await sendMail(email, `Goodbye ${name}`, exitMail(env.SITE_NAME, `${env.HOST}/complain`))
  if (!result.ok) logger.warn({ reason: result.reason }, 'exit email not sent')
}
