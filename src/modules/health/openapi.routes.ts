import { Router } from 'express'
import { buildOpenApiDocument } from '../../openapi/document'
import { env } from '../../config/env'

export const openApiRouter = Router()

// Built once — the registry is static. The served copy advertises the real
// host; the committed copy stays relative.
const document = buildOpenApiDocument(env.HOST)

openApiRouter.get('/openapi.json', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300')
  res.json(document)
})
