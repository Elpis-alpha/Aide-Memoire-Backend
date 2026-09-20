import { z } from 'zod'
import { objectIdSchema } from '../../lib/object-id'

const tagName = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'A tag needs a name')
  .max(60)

export const createTagSchema = z.object({ name: tagName })

export const createManyTagsSchema = z.object({
  names: z.array(tagName).min(1, 'Supply at least one tag').max(100),
})

export const tagIdParamsSchema = z.object({ id: objectIdSchema })

export const tagSearchQuerySchema = z.object({
  prefix: z.string().trim().min(1).max(60),
  limit: z.coerce.number().int().min(1).max(25).default(10),
})
