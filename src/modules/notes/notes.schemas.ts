import { z } from 'zod'
import { objectIdSchema } from '../../lib/object-id'
import { paginationSchema } from '../../lib/pagination'

export const createNoteSchema = z.object({
  name: z.string().trim().min(1, 'A note needs a name').max(200),
  description: z.string().trim().max(1000).default(''),
  text: z.string().max(5_000_000).default(''),
  sections: z.array(objectIdSchema).max(50).default([]),
  tags: z.array(objectIdSchema).max(50).default([]),
})

/**
 * `isPublic`, `canDelete`, `specialName` and `owner` are deliberately absent:
 * the old handler spread `req.body` straight into `new Note(...)`, so any of
 * them could be set by the client. Visibility changes go through the explicit
 * toggle route.
 */
export const updateNoteSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    text: z.string().max(5_000_000).optional(),
  })
  .refine(value => Object.keys(value).length > 0, { message: 'No updatable fields supplied' })

export const noteIdParamsSchema = z.object({ id: objectIdSchema })

export const noteRelationParamsSchema = z.object({
  id: objectIdSchema,
  relationId: objectIdSchema,
})

export const addRelationSchema = z.object({ id: objectIdSchema })

export const sectionNoteParamsSchema = z.object({
  sectionId: objectIdSchema,
  noteId: objectIdSchema,
})

export const specialNameParamsSchema = z.object({
  name: z.string().trim().min(1).max(60),
})

export const tagIdParamsSchema = z.object({ tagId: objectIdSchema })

export const listQuerySchema = paginationSchema

export const searchQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1, 'A search term is required').max(200),
})

export type CreateNoteInput = z.infer<typeof createNoteSchema>
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>
