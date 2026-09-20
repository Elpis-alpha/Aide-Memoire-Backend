import { z } from 'zod'
import { objectIdSchema } from '../../lib/object-id'
import { paginationSchema } from '../../lib/pagination'

export const createSectionSchema = z.object({
  name: z.string().trim().min(1, 'A section needs a name').max(120),
  description: z.string().trim().max(1000).default(''),
})

/** `canDelete` and `owner` stay server-controlled. */
export const updateSectionSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).optional(),
    isPublic: z.boolean().optional(),
  })
  .refine(value => Object.keys(value).length > 0, { message: 'No updatable fields supplied' })

export const sectionIdParamsSchema = z.object({ id: objectIdSchema })
export const sectionListQuerySchema = paginationSchema

export type CreateSectionInput = z.infer<typeof createSectionSchema>
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>
