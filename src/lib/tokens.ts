import { createHash, randomBytes } from 'node:crypto'
import jwt, { type SignOptions } from 'jsonwebtoken'
import type { Response } from 'express'
import type { Types } from 'mongoose'
import { env } from '../config/env'
import { RefreshToken } from '../models/refresh-token.model'

export const ACCESS_COOKIE = 'am_access'
export const REFRESH_COOKIE = 'am_refresh'

/** Path scoping means the refresh cookie is not attached to ordinary API calls. */
const REFRESH_COOKIE_PATH = '/api/auth'

export type AccessTokenPayload = {
  sub: string
  /** Seconds since epoch; refuses tokens minted before a password change (S1-08). */
  iat?: number
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export const signAccessToken = (userId: Types.ObjectId | string): string =>
  jwt.sign({ sub: userId.toString() }, env.JWT_ACCESS_SECRET, {
    // S1-07 — the old tokens were signed with `{}` for options, so they never
    // expired. A single leak was permanent.
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: 'aide-memoire',
  } as SignOptions)

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'aide-memoire' }) as AccessTokenPayload

/**
 * Opaque, high-entropy and never a JWT: it carries no claims, so it is only
 * as useful as the database row it points at, and revocation is a delete.
 */
export const issueRefreshToken = async (userId: Types.ObjectId): Promise<string> => {
  const token = randomBytes(48).toString('base64url')
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  await RefreshToken.create({ user: userId, tokenHash: sha256(token), expiresAt })
  return token
}

export type RotationResult =
  | { ok: true; userId: Types.ObjectId; token: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'reused' }

/**
 * Single-use rotation. Presenting an already-rotated token means either a
 * race or a stolen token, so every session for that user is revoked.
 */
export const rotateRefreshToken = async (presented: string): Promise<RotationResult> => {
  const tokenHash = sha256(presented)
  const existing = await RefreshToken.findOne({ tokenHash })

  if (!existing) return { ok: false, reason: 'invalid' }

  if (existing.revokedAt) {
    await RefreshToken.deleteMany({ user: existing.user })
    return { ok: false, reason: 'reused' }
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    await RefreshToken.deleteOne({ _id: existing._id })
    return { ok: false, reason: 'expired' }
  }

  const next = await issueRefreshToken(existing.user)
  existing.revokedAt = new Date()
  existing.replacedByHash = sha256(next)
  await existing.save()

  return { ok: true, userId: existing.user, token: next }
}

export const revokeRefreshToken = async (presented: string): Promise<void> => {
  await RefreshToken.deleteOne({ tokenHash: sha256(presented) })
}

export const revokeAllRefreshTokens = async (userId: Types.ObjectId): Promise<void> => {
  await RefreshToken.deleteMany({ user: userId })
}

const baseCookie = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax' as const,
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
}

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookie,
    path: '/',
    maxAge: 15 * 60 * 1000,
  })
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie,
    path: REFRESH_COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  })
}

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie, path: '/' })
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: REFRESH_COOKIE_PATH })
}

/** Single-use, hashed, time-limited email verification token (S1-01). */
export const createVerificationToken = () => {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }
}

export const hashVerificationToken = sha256
