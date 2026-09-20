import { Router } from 'express'
import { validate } from '../../lib/validate'
import { requireAuth } from '../../middleware/auth'
import { authLimiter, mailLimiter } from '../../middleware/rate-limit'
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  verifyTokenSchema,
} from './auth.schemas'
import {
  confirmVerificationJson,
  login,
  logout,
  logoutAll,
  refresh,
  register,
  requestVerification,
  updatePassword,
} from './auth.controller'

export const authRouter = Router()

// S1-06 / S3-14 — credential endpoints are the ones worth brute forcing, and
// previously had no limiter at all.
authRouter.post('/register', authLimiter, validate({ body: registerSchema }), register)
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), login)
authRouter.post('/refresh', refresh)
authRouter.post('/logout', logout)
authRouter.post('/logout-all', requireAuth, logoutAll)

authRouter.post('/verify/request', requireAuth, mailLimiter, requestVerification)
authRouter.post(
  '/verify/confirm',
  requireAuth,
  validate({ body: verifyTokenSchema }),
  confirmVerificationJson,
)

authRouter.post(
  '/password',
  requireAuth,
  authLimiter,
  validate({ body: changePasswordSchema }),
  updatePassword,
)
