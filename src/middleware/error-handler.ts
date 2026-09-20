import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import mongoose from 'mongoose'
import { AppError, isAppError } from '../lib/errors'
import { logger } from '../lib/logger'
import { env } from '../config/env'

const wantsJson = (path: string) => path.startsWith('/api')

/** Terminal 404 for anything no router claimed. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound())
}

const normalise = (error: unknown): AppError => {
  if (isAppError(error)) return error

  if (error instanceof ZodError) {
    return AppError.badRequest(
      'Your request is invalid',
      error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    )
  }

  // A malformed ObjectId is a client mistake, not a server fault, and must
  // read as "not found" so it cannot be used to probe which ids exist.
  if (error instanceof mongoose.Error.CastError) return AppError.notFound()

  if (error instanceof mongoose.Error.ValidationError) {
    return AppError.badRequest(
      'Your request is invalid',
      Object.values(error.errors).map(issue => ({
        path: issue.path,
        message: issue.message,
      })),
    )
  }

  // Duplicate key — surfaces on unique indexes such as the user email.
  if (typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000) {
    return AppError.conflict('That already exists')
  }

  return new AppError(500, 'internal_error', 'Our server has some issues apparently')
}

/**
 * Express 5 routes rejected promises here automatically, which is what removes
 * the hanging requests in S2-02 — handlers no longer need their own try/catch
 * purely to avoid an unhandled rejection.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = normalise(error)

  if (appError.status >= 500) {
    logger.error({ err: error, path: req.path, method: req.method }, 'request failed')
  } else {
    logger.warn(
      { code: appError.code, status: appError.status, path: req.path, method: req.method },
      'request rejected',
    )
  }

  if (res.headersSent) return

  if (wantsJson(req.path)) {
    res.status(appError.status).json({
      error: appError.message,
      code: appError.code,
      ...(appError.details ? { details: appError.details } : {}),
    })
    return
  }

  res.status(appError.status).render('404', {
    title: `${appError.status} Error Page`,
    email: env.EMAIL_ADDRESS,
    siteName: env.SITE_NAME,
    frontendLocation: env.FRONT_END_LOCATION,
    code: appError.status,
    error: appError.message,
    complainLink: '/complain',
    homeLink: '/',
  })
}
