/**
 * One error type for everything a handler intends to surface. Anything else
 * reaching the error middleware is treated as an unexpected 500 and its
 * message is never sent to the client.
 */
export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
    Error.captureStackTrace?.(this, AppError)
  }

  static badRequest(message = 'Your request is invalid', details?: unknown) {
    return new AppError(400, 'bad_request', message, details)
  }

  static unauthorized(message = 'You are not authenticated') {
    return new AppError(401, 'unauthorized', message)
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new AppError(403, 'forbidden', message)
  }

  /**
   * Used for both "missing" and "not yours". Collapsing the two prevents the
   * ownership-probing oracle that separate 403/404 responses would create.
   */
  static notFound(message = 'The resource you are looking for does not exist') {
    return new AppError(404, 'not_found', message)
  }

  static conflict(message = 'That conflicts with something that already exists') {
    return new AppError(409, 'conflict', message)
  }

  static tooManyRequests(message = 'Too many requests — slow down') {
    return new AppError(429, 'rate_limited', message)
  }

  static serviceUnavailable(message = 'That service is currently unavailable') {
    return new AppError(503, 'service_unavailable', message)
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError
