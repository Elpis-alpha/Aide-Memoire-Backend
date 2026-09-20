import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import { registry } from './registry'

/**
 * The backend owns the contract: these are the same zod schemas the routes
 * validate with, so the spec cannot drift from what the API actually accepts.
 * The frontend runs `openapi-typescript` against this to generate its types.
 */
/**
 * `serverUrl` is a parameter rather than a read of env.HOST so the committed
 * artifact stays environment-independent. The file on disk uses a relative
 * server (which `openapi-typescript` is happy with), while the live
 * /openapi.json advertises the real host it is being served from. Baking
 * env.HOST into the committed copy made the CI drift check fail whenever the
 * runner's HOST differed from a developer's.
 */
export const buildOpenApiDocument = (serverUrl = '/') =>
  new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Aide-mémoire API',
      version: '2.0.0',
      description:
        'Notes, sections and tags. Authentication is a short-lived access cookie plus a rotating refresh cookie.',
    },
    servers: [{ url: serverUrl }],
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
