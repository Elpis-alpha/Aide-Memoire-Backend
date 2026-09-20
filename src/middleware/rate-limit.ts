import rateLimit, { type Store } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import Redis from 'ioredis'
import { env } from '../config/env'
import { logger } from '../lib/logger'
import { AppError } from '../lib/errors'

/**
 * Redis-backed when REDIS_URL is set so counters survive restarts and are
 * shared across replicas; in-memory otherwise, which keeps the API runnable
 * locally before Compose introduces Redis in Phase 2.
 */
let redis: Redis | undefined

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false })
  redis.on('error', error => logger.error({ err: error }, 'redis error'))
  logger.info('rate limiting backed by redis')
} else if (env.isProduction) {
  logger.warn('REDIS_URL is unset — rate limit counters are per-process and reset on restart')
}

const makeStore = (prefix: string): Store | undefined =>
  redis
    ? new RedisStore({
        prefix: `rl:${prefix}:`,
        sendCommand: (...args: string[]) => redis!.call(...(args as [string, ...string[]])) as never,
      })
    : undefined

type LimiterOptions = {
  name: string
  windowMs: number
  limit: number
  message?: string
}

const createLimiter = ({ name, windowMs, limit, message }: LimiterOptions) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Tests would otherwise fail on shared counters between cases.
    skip: () => env.isTest,
    store: makeStore(name),
    handler: (_req, _res, next) => {
      next(AppError.tooManyRequests(message))
    },
  })

/** Broad ceiling applied to the whole API surface. */
export const globalLimiter = createLimiter({
  name: 'global',
  windowMs: 15 * 60 * 1000,
  limit: 1000,
})

/** Credential endpoints — the ones worth brute forcing. */
export const authLimiter = createLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many attempts. Try again in a few minutes.',
})

/** Anything that causes an outbound email (S1-06). */
export const mailLimiter = createLimiter({
  name: 'mail',
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many messages sent. Try again later.',
})

/** Writes that any authenticated user can trigger, e.g. tag creation (S1-04). */
export const writeLimiter = createLimiter({
  name: 'write',
  windowMs: 60 * 1000,
  limit: 60,
})

export const closeRateLimitStore = async (): Promise<void> => {
  if (redis) await redis.quit()
}
