import { z } from 'zod'

/**
 * Every environment variable the API reads, validated once at boot (S2-11).
 * A missing or malformed required value fails the process immediately rather
 * than surfacing as an undefined deep inside a request handler.
 *
 * Mail and media credentials are deliberately optional: a mail outage must not
 * become a crash loop under `restart: unless-stopped`, so the mail module
 * degrades to "not configured" instead of the process refusing to start.
 */

const csv = z
  .string()
  .transform(value => value.split(',').map(entry => entry.trim()).filter(Boolean))

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  // ---- Database ----
  MONGODB_URL: z.string().min(1, 'MONGODB_URL is required'),

  // ---- Identity ----
  // Separate secrets so a leaked access secret cannot mint refresh tokens.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_DOMAIN: z.string().optional(),

  // ---- Public identity / links ----
  HOST: z.string().url('HOST must be an absolute URL'),
  SITE_NAME: z.string().min(1),
  FRONT_END_LOCATION: z.string().url('FRONT_END_LOCATION must be an absolute URL'),
  CORS_ORIGINS: csv.optional(),

  // ---- Mail (optional — failures are non-fatal) ----
  EMAIL_ADDRESS: z.string().email(),
  EMAIL_NAME: z.string().min(1),
  MAIL_CLIENT_ID: z.string().optional(),
  MAIL_CLIENT_SECRET: z.string().optional(),
  MAIL_REFRESH_TOKEN: z.string().optional(),

  // ---- Media (optional — signed uploads are refused when absent) ----
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('aide-memoire'),

  // ---- Infrastructure ----
  REDIS_URL: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map(issue => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  // Intentionally console, not pino: the logger itself depends on this module.
  console.error(`Invalid environment configuration:\n${issues}`)
  process.exit(1)
}

const raw = parsed.data

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  /** Origins allowed to send credentialed requests. Defaults to the frontend. */
  corsOrigins: raw.CORS_ORIGINS?.length ? raw.CORS_ORIGINS : [raw.FRONT_END_LOCATION],
  mailConfigured: Boolean(raw.MAIL_CLIENT_ID && raw.MAIL_CLIENT_SECRET && raw.MAIL_REFRESH_TOKEN),
  mediaConfigured: Boolean(
    raw.CLOUDINARY_CLOUD_NAME && raw.CLOUDINARY_API_KEY && raw.CLOUDINARY_API_SECRET,
  ),
} as const

export type Env = typeof env
