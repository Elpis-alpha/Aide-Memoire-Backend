import type { RequestHandler } from 'express'
import { AppError } from '../../lib/errors'
import { body } from '../../lib/validate'
import { currentUser } from '../../middleware/auth'
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  issueRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  setAuthCookies,
  signAccessToken,
} from '../../lib/tokens'
import { User } from '../../models/user.model'
import {
  changePassword,
  confirmVerification,
  createUser,
  issueVerificationEmail,
  provisionWelcomeContent,
} from './auth.service'
import { changePasswordSchema, loginSchema, registerSchema, verifyTokenSchema } from './auth.schemas'

export const register: RequestHandler = async (req, res) => {
  const input = body(req, registerSchema)

  const user = await createUser(input)
  await provisionWelcomeContent(user._id)
  await issueVerificationEmail(user)

  const accessToken = signAccessToken(user._id)
  const refreshToken = await issueRefreshToken(user._id)
  setAuthCookies(res, accessToken, refreshToken)

  res.status(201).json({ user })
}

export const login: RequestHandler = async (req, res) => {
  const input = body(req, loginSchema)

  const user = await User.findByCredentials(input.email, input.password)
  // One message for both "no such account" and "wrong password" — separate
  // responses would confirm which addresses are registered.
  if (!user) throw AppError.badRequest('Email or password is incorrect')

  const accessToken = signAccessToken(user._id)
  const refreshToken = await issueRefreshToken(user._id)
  setAuthCookies(res, accessToken, refreshToken)

  res.json({ user })
}

export const refresh: RequestHandler = async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE]
  if (typeof presented !== 'string' || !presented) throw AppError.unauthorized()

  const result = await rotateRefreshToken(presented)
  if (!result.ok) {
    clearAuthCookies(res)
    throw AppError.unauthorized()
  }

  const user = await User.findById(result.userId)
  if (!user) {
    clearAuthCookies(res)
    throw AppError.unauthorized()
  }

  setAuthCookies(res, signAccessToken(user._id), result.token)
  res.json({ user })
}

export const logout: RequestHandler = async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE]
  if (typeof presented === 'string' && presented) await revokeRefreshToken(presented)

  clearAuthCookies(res)
  res.json({ message: 'Logout Successful' })
}

export const logoutAll: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  await revokeAllRefreshTokens(user._id)

  clearAuthCookies(res)
  res.json({ message: 'Logout Successful' })
}

export const requestVerification: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  await issueVerificationEmail(user)
  res.json({ message: 'Verification email sent' })
}

export const confirmVerificationJson: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { token } = body(req, verifyTokenSchema)

  await confirmVerification(user._id.toString(), token)
  res.json({ message: 'Email verified' })
}

export const updatePassword: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { oldPassword, newPassword } = body(req, changePasswordSchema)

  await changePassword(user, oldPassword, newPassword)

  // Every other session is now dead; re-issue for the caller so changing a
  // password does not log you out of the device you did it on.
  await revokeAllRefreshTokens(user._id)
  const refreshToken = await issueRefreshToken(user._id)
  setAuthCookies(res, signAccessToken(user._id), refreshToken)

  res.json({ message: 'Password updated' })
}
