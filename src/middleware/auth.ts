import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { AppError } from '../lib/errors'
import { ACCESS_COOKIE, verifyAccessToken } from '../lib/tokens'
import { User } from '../models/user.model'

const readToken = (req: Request): string | null => {
  const cookie = req.cookies?.[ACCESS_COOKIE]
  if (typeof cookie === 'string' && cookie.length > 0) return cookie

  // Bearer remains accepted for non-browser clients and the OpenAPI examples.
  const header = req.header('authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7)

  return null
}

const resolveUser = async (token: string) => {
  const payload = verifyAccessToken(token)
  const user = await User.findById(payload.sub)
  if (!user) return null

  // S1-08 — a password change invalidates every token minted before it, so
  // changing a password really does log out the other sessions.
  if (user.passwordChangedAt && payload.iat) {
    if (payload.iat * 1000 < user.passwordChangedAt.getTime()) return null
  }

  return user
}

export const requireAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = readToken(req)
    if (!token) return next(AppError.unauthorized())

    const user = await resolveUser(token)
    if (!user) return next(AppError.unauthorized())

    req.user = user
    next()
  } catch {
    next(AppError.unauthorized())
  }
}

/** Attaches the user when a valid token is present, but never rejects. */
export const optionalAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = readToken(req)
    if (token) {
      const user = await resolveUser(token)
      if (user) req.user = user
    }
  } catch {
    // An invalid token on an optional route is simply an anonymous request.
  }
  next()
}

/** Narrowing helper for handlers mounted behind `requireAuth`. */
export const currentUser = (req: Request) => {
  if (!req.user) throw AppError.unauthorized()
  return req.user
}
