import type { Server } from 'node:http'
import { createApp } from './app'
import { env } from './config/env'
import { logger } from './lib/logger'
import { connectToDatabase, disconnectFromDatabase } from './db/connect'
import { closeRateLimitStore } from './middleware/rate-limit'
import { verifyMailer } from './mail/mailer'

const start = async () => {
  // Await the database before accepting traffic (S2-12).
  await connectToDatabase()

  // Probed for the log line only. A mail outage must never stop listen(),
  // or `restart: unless-stopped` turns it into a crash loop.
  void verifyMailer()

  const app = createApp()
  const server: Server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server listening')
  })

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down')

    // Stop accepting connections, then let in-flight requests drain.
    const closed = new Promise<void>(resolve => server.close(() => resolve()))
    const timedOut = new Promise<void>(resolve => setTimeout(resolve, 10_000).unref())
    await Promise.race([closed, timedOut])

    await Promise.allSettled([disconnectFromDatabase(), closeRateLimitStore()])
    logger.info('shutdown complete')
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

start().catch(error => {
  logger.fatal({ err: error }, 'failed to start')
  process.exit(1)
})
