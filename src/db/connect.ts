import mongoose from 'mongoose'
import { env } from '../config/env'
import { logger } from '../lib/logger'

/**
 * The old implementation retried forever in a module-level loop while the
 * server was already listening, so the API accepted traffic it could not
 * serve (S2-12). Connection is now awaited before `listen()`.
 */
export const connectToDatabase = async (uri: string = env.MONGODB_URL): Promise<void> => {
  mongoose.set('strictQuery', true)

  mongoose.connection.on('disconnected', () => logger.warn('mongo disconnected'))
  mongoose.connection.on('reconnected', () => logger.info('mongo reconnected'))

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
  })

  logger.info({ database: mongoose.connection.name }, 'mongo connected')
}

export const disconnectFromDatabase = async (): Promise<void> => {
  await mongoose.connection.close(false)
  logger.info('mongo connection closed')
}

/** Readiness signal for `/readyz`. 1 === connected. */
export const isDatabaseReady = (): boolean => mongoose.connection.readyState === 1
