import { Router } from 'express'
import { validate } from '../../lib/validate'
import { requireAuth } from '../../middleware/auth'
import { writeLimiter } from '../../middleware/rate-limit'
import {
  createSectionSchema,
  sectionIdParamsSchema,
  sectionListQuerySchema,
  updateSectionSchema,
} from './sections.schemas'
import * as controller from './sections.controller'

export const sectionsRouter = Router()

sectionsRouter.use(requireAuth)

sectionsRouter.post('/', writeLimiter, validate({ body: createSectionSchema }), controller.create)
sectionsRouter.get('/', controller.list)
sectionsRouter.get('/:id', validate({ params: sectionIdParamsSchema }), controller.getOne)
sectionsRouter.get('/:id/notes', validate({ params: sectionIdParamsSchema, query: sectionListQuerySchema }), controller.listNotes)
sectionsRouter.patch('/:id', writeLimiter, validate({ params: sectionIdParamsSchema, body: updateSectionSchema }), controller.update)
sectionsRouter.post('/:id/toggle-open', writeLimiter, validate({ params: sectionIdParamsSchema }), controller.toggleOpen)
sectionsRouter.post('/:id/toggle-public', writeLimiter, validate({ params: sectionIdParamsSchema }), controller.togglePublic)
sectionsRouter.delete('/:id', writeLimiter, validate({ params: sectionIdParamsSchema }), controller.remove)

export const publicSectionsRouter = Router()
publicSectionsRouter.get('/sections/:id', validate({ params: sectionIdParamsSchema }), controller.getPublicOne)
