import type { UserDocument } from '../models/user.model'

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth` / `optionalAuth`. */
      user?: UserDocument
      /** Parsed and typed by the `validate` middleware. */
      valid?: {
        body?: unknown
        params?: unknown
        query?: unknown
      }
    }
  }
}

export {}
