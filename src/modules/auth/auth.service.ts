import type { Types } from 'mongoose'
import { env } from '../../config/env'
import { AppError } from '../../lib/errors'
import { logger } from '../../lib/logger'
import { User, type UserDocument } from '../../models/user.model'
import { Note } from '../../models/note.model'
import { Section } from '../../models/section.model'
import { createVerificationToken, hashVerificationToken } from '../../lib/tokens'
import { sendMail } from '../../mail/mailer'
import { welcomeMail } from '../../mail/mail-templates'
import { welcomeNote } from '../../mail/note-templates'
import type { RegisterInput } from './auth.schemas'

/**
 * Services take typed inputs and know nothing about req/res, which is what
 * makes any of this testable — the previous logic lived inside route handlers.
 */

export const createUser = async (input: RegisterInput): Promise<UserDocument> => {
  const existing = await User.exists({ email: input.email })
  // The address is already unique-indexed; this just turns the duplicate-key
  // error into a clear message rather than a generic 409.
  if (existing) throw AppError.conflict('An account with that email already exists')

  const user = new User({
    name: input.name,
    email: input.email,
    password: input.password,
  })

  await user.save()
  return user
}

/** The two default sections and the welcome note every new account starts with. */
export const provisionWelcomeContent = async (userId: Types.ObjectId): Promise<void> => {
  await Section.insertMany([
    {
      owner: userId,
      name: 'Favorite',
      canDelete: false,
      description: 'A special section for keeping special (favored) notes.',
    },
    {
      owner: userId,
      name: 'Important',
      canDelete: false,
      description: 'A special section for keeping notes of great significance or value.',
    },
  ])

  await Note.create({
    owner: userId,
    name: 'Welcome',
    canDelete: false,
    isPublic: false,
    specialName: 'welcome',
    // The illustration is a static asset and the link points at the frontend
    // (S2-18, S2-19) rather than being inlined and broken respectively.
    text: welcomeNote(env.HOST, env.FRONT_END_LOCATION),
  })
}

/**
 * S1-01 — mints a fresh random token per call, stores only its hash, and gives
 * it a 24 hour expiry. The old field was a single process-wide UUID shared by
 * every account registered during that process.
 */
export const issueVerificationEmail = async (user: UserDocument): Promise<void> => {
  if (user.emailVerifiedAt) throw AppError.conflict('That email is already verified')

  const { token, tokenHash, expiresAt } = createVerificationToken()

  user.verificationTokenHash = tokenHash
  user.verificationTokenExpiresAt = expiresAt
  await user.save()

  const link = `${env.HOST}/mail/welcome-mail/${user._id.toString()}/${token}`
  const result = await sendMail(user.email, `Welcome to ${env.SITE_NAME}`, welcomeMail(env.SITE_NAME, link))

  // Deliberately not fatal — the account exists and the user can request
  // another verification mail.
  if (!result.ok) {
    logger.warn({ userId: user._id.toString(), reason: result.reason }, 'verification email not sent')
  }
}

/**
 * Single use: the hash is cleared whether or not it was still valid, so a
 * leaked link cannot be replayed.
 */
export const confirmVerification = async (userId: string, token: string): Promise<UserDocument> => {
  const user = await User.findById(userId).select('+verificationTokenHash +verificationTokenExpiresAt')
  if (!user) throw AppError.notFound('That verification link is not valid')

  if (user.emailVerifiedAt) throw AppError.conflict('That email is already verified')

  const expected = user.verificationTokenHash
  const expiresAt = user.verificationTokenExpiresAt

  if (!expected || !expiresAt) throw AppError.notFound('That verification link is not valid')
  if (expiresAt.getTime() <= Date.now()) throw AppError.badRequest('That verification link has expired')
  if (hashVerificationToken(token) !== expected) {
    throw AppError.notFound('That verification link is not valid')
  }

  user.emailVerifiedAt = new Date()
  user.verificationTokenHash = null
  user.verificationTokenExpiresAt = null
  await user.save()

  return user
}

export const changePassword = async (
  user: UserDocument,
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  const withPassword = await User.findById(user._id).select('+password')
  if (!withPassword) throw AppError.unauthorized()

  const matches = await withPassword.comparePassword(oldPassword)
  if (!matches) throw AppError.badRequest('Your current password is incorrect')

  // The pre-save hook re-hashes and stamps passwordChangedAt, which is what
  // invalidates access tokens issued before this moment (S1-08).
  withPassword.password = newPassword
  await withPassword.save()
}

/**
 * Checks a verification token without consuming it, so the intermediate
 * welcome page can be rendered before the user chooses verify or delete.
 */
export const checkVerificationToken = async (
  userId: string,
  token: string,
): Promise<UserDocument> => {
  const user = await User.findById(userId).select('+verificationTokenHash +verificationTokenExpiresAt')
  if (!user) throw AppError.notFound('That link is not valid')

  const expected = user.verificationTokenHash
  const expiresAt = user.verificationTokenExpiresAt

  if (!expected || !expiresAt) throw AppError.notFound('That link is not valid')
  if (expiresAt.getTime() <= Date.now()) throw AppError.badRequest('That link has expired')
  if (hashVerificationToken(token) !== expected) throw AppError.notFound('That link is not valid')

  return user
}

/**
 * The "I didn't create this account" path from the welcome email. Only ever
 * removes an unverified account, and only with a valid token.
 */
export const deleteUnverifiedAccount = async (userId: string, token: string): Promise<void> => {
  const user = await checkVerificationToken(userId, token)
  if (user.emailVerifiedAt) throw AppError.forbidden('That account is already verified')

  await Promise.all([
    Note.deleteMany({ owner: user._id }),
    Section.deleteMany({ owner: user._id }),
  ])
  await User.deleteOne({ _id: user._id })
}
