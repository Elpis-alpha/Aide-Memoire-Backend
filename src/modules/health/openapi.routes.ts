import { Router } from 'express'
import { buildOpenApiDocument } from '../../openapi/document'

export const openApiRouter = Router()

// Built once — the registry is static.
const document = buildOpenApiDocument()

openApiRouter.get('/openapi.json', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300')
  res.json(document)
})
