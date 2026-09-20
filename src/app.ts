import path from 'node:path'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'
import hbs from 'hbs'
import { randomUUID } from 'node:crypto'
import { env } from './config/env'
import { logger } from './lib/logger'
import { AppError } from './lib/errors'
import { errorHandler, notFoundHandler } from './middleware/error-handler'
import { globalLimiter } from './middleware/rate-limit'
import { healthRouter } from './modules/health/health.routes'
import { openApiRouter } from './modules/health/openapi.routes'
import { authRouter } from './modules/auth/auth.routes'
import { usersRouter } from './modules/users/users.routes'
import { notesRouter, publicNotesRouter, treeRouter } from './modules/notes/notes.routes'
import { publicSectionsRouter, sectionsRouter } from './modules/sections/sections.routes'
import { tagsRouter } from './modules/tags/tags.routes'
import { contactRouter } from './modules/contact/contact.routes'
import { mediaRouter } from './modules/media/media.routes'
import { renderRouter } from './modules/render/render.routes'

export const createApp = () => {
  const app = express()

  // nginx terminates TLS and forwards X-Forwarded-*; without this the rate
  // limiter would see the proxy's IP for every client.
  app.set('trust proxy', env.TRUST_PROXY)
  app.disable('x-powered-by')

  app.set('view engine', 'hbs')
  app.set('views', path.join(__dirname, '../template/views'))
  hbs.registerPartials(path.join(__dirname, '../template/partials'))

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = req.headers['x-request-id']
        const id = typeof existing === 'string' ? existing : randomUUID()
        res.setHeader('x-request-id', id)
        return id
      },
      autoLogging: { ignore: req => req.url === '/healthz' || req.url === '/readyz' },
    }),
  )

  app.use(helmet())

  app.use(
    cors({
      // An explicit allowlist, not a reflected origin (S3-11). Requests with
      // no Origin (server-to-server, curl) are allowed; a browser request from
      // an unlisted origin is rejected.
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true)
        callback(new AppError(403, 'cors_rejected', 'Origin not allowed'))
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )

  app.use(cookieParser())

  // Conservative default. Routes that legitimately carry large payloads raise
  // it for themselves rather than every endpoint inheriting a 20mb ceiling.
  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: true, limit: '100kb' }))

  app.use(express.static(path.join(__dirname, '../public')))

  app.use(healthRouter)
  app.use(openApiRouter)

  app.use('/api', globalLimiter)

  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/notes', notesRouter)
  app.use('/api/sections', sectionsRouter)
  app.use('/api/tags', tagsRouter)
  app.use('/api/tree', treeRouter)
  app.use('/api/media', mediaRouter)
  app.use('/api/mail', contactRouter)

  // Unauthenticated, edge-cacheable read surface.
  app.use('/api/public', publicNotesRouter)
  app.use('/api/public', publicSectionsRouter)

  // Server-rendered pages the transactional emails link to.
  app.use(renderRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
