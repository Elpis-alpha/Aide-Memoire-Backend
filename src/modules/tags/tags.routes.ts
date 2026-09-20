import { Router } from 'express'
import { validate } from '../../lib/validate'
import { requireAuth } from '../../middleware/auth'
import { writeLimiter } from '../../middleware/rate-limit'
import { createManyTagsSchema, createTagSchema, tagIdParamsSchema, tagSearchQuerySchema } from './tags.schemas'
import * as controller from './tags.controller'

export const tagsRouter = Router()

/**
 * S1-04 — tag creation was entirely unauthenticated and unlimited, so anyone
 * could fill the shared collection. Reads stay open; writes need an account.
 */
tagsRouter.post('/', requireAuth, writeLimiter, validate({ body: createTagSchema }), controller.create)
tagsRouter.post('/bulk', requireAuth, writeLimiter, validate({ body: createManyTagsSchema }), controller.createMany)

tagsRouter.get('/search', validate({ query: tagSearchQuerySchema }), controller.search)
tagsRouter.get('/:id', validate({ params: tagIdParamsSchema }), controller.getOne)
