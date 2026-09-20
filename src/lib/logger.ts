import pino from 'pino'
import { env } from '../config/env'

/**
 * Structured JSON to stdout — no log files, so the container stays stateless
 * and K8s-ready. Pretty-printed only in development.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'aide-memoire-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
    ],
    censor: '[redacted]',
  },
  ...(env.isProduction || env.isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }),
})
