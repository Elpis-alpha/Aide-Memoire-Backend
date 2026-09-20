import { Router } from 'express'
import mongoose from 'mongoose'
import { isDatabaseReady } from '../../db/connect'

export const healthRouter = Router()

/**
 * Liveness (S2-12). Answers "is the process running" only — it must not
 * depend on Mongo, or a database blip would have the orchestrator restart a
 * perfectly healthy container.
 */
healthRouter.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

/** Readiness. Answers "should this instance receive traffic". */
healthRouter.get('/readyz', (_req, res) => {
  const ready = isDatabaseReady()
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: { mongo: mongoose.connection.readyState === 1 ? 'up' : 'down' },
  })
})
