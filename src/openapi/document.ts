import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import { registry } from './registry'
import { env } from '../config/env'

/**
 * The backend owns the contract: these are the same zod schemas the routes
 * validate with, so the spec cannot drift from what the API actually accepts.
 * The frontend runs `openapi-typescript` against this to generate its types.
 */
export const buildOpenApiDocument = () =>
  new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Aide-mémoire API',
      version: '2.0.0',
      description:
        'Notes, sections and tags. Authentication is a short-lived access cookie plus a rotating refresh cookie.',
    },
    servers: [{ url: env.HOST }],
    tags: [
      { name: 'Auth' },
      { name: 'Users' },
      { name: 'Notes' },
      { name: 'Sections' },
      { name: 'Tags' },
      { name: 'Public', description: 'Unauthenticated, edge-cacheable reads.' },
      { name: 'Media' },
      { name: 'Contact' },
      { name: 'Health' },
    ],
  })
