import { Router, json } from 'express'
import { validate } from '../../lib/validate'
import { requireAuth } from '../../middleware/auth'
import { writeLimiter } from '../../middleware/rate-limit'
import {
  addRelationSchema,
  createNoteSchema,
  listQuerySchema,
  noteIdParamsSchema,
  noteRelationParamsSchema,
  searchQuerySchema,
  sectionNoteParamsSchema,
  specialNameParamsSchema,
  tagIdParamsSchema,
  updateNoteSchema,
} from './notes.schemas'
import * as controller from './notes.controller'

/**
 * Note bodies are rich text and, until Phase 3 migrates the inlined base64
 * images out, can be large — so these two routes raise the 100kb default
 * rather than every endpoint inheriting the old 20mb ceiling.
 */
const noteBody = json({ limit: '5mb' })

export const notesRouter = Router()

notesRouter.use(requireAuth)

notesRouter.post('/', writeLimiter, noteBody, validate({ body: createNoteSchema }), controller.create)
notesRouter.get('/', validate({ query: listQuerySchema }), controller.list)
notesRouter.get('/free', validate({ query: listQuerySchema }), controller.listFree)
notesRouter.get('/search', validate({ query: searchQuerySchema }), controller.search)
notesRouter.get('/special/:name', validate({ params: specialNameParamsSchema }), controller.getBySpecialName)
notesRouter.get('/by-tag/:tagId', validate({ params: tagIdParamsSchema, query: listQuerySchema }), controller.listByTag)

notesRouter.get('/:id', validate({ params: noteIdParamsSchema }), controller.getOne)
notesRouter.patch('/:id', writeLimiter, noteBody, validate({ params: noteIdParamsSchema, body: updateNoteSchema }), controller.update)
notesRouter.delete('/:id', writeLimiter, validate({ params: noteIdParamsSchema }), controller.remove)
notesRouter.post('/:id/toggle-public', writeLimiter, validate({ params: noteIdParamsSchema }), controller.toggleVisibility)

notesRouter.post('/:id/sections', writeLimiter, validate({ params: noteIdParamsSchema, body: addRelationSchema }), controller.addSection)
notesRouter.delete('/:id/sections/:relationId', writeLimiter, validate({ params: noteRelationParamsSchema }), controller.removeSection)
notesRouter.post('/:id/tags', writeLimiter, validate({ params: noteIdParamsSchema, body: addRelationSchema }), controller.addTag)
notesRouter.delete('/:id/tags/:relationId', writeLimiter, validate({ params: noteRelationParamsSchema }), controller.removeTag)

/** One request for the whole sidebar (S2-23). */
export const treeRouter = Router()
treeRouter.get('/', requireAuth, controller.tree)

/** Unauthenticated, cacheable surface. */
export const publicNotesRouter = Router()
publicNotesRouter.get('/notes/search', validate({ query: searchQuerySchema }), controller.searchPublic)
publicNotesRouter.get('/notes/by-tag/:tagId', validate({ params: tagIdParamsSchema, query: listQuerySchema }), controller.listPublicByTag)
publicNotesRouter.get('/notes/:id', validate({ params: noteIdParamsSchema }), controller.getPublicOne)
publicNotesRouter.get('/sections/:id/notes', validate({ params: noteIdParamsSchema, query: listQuerySchema }), controller.listPublicInSection)
publicNotesRouter.get('/sections/:sectionId/notes/:noteId', validate({ params: sectionNoteParamsSchema }), controller.getPublicInSection)
