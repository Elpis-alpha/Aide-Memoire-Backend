import { z } from 'zod'
import { objectIdSchema } from '../../lib/object-id'

/**
 * S1-08 — `password` was in the PATCH allowlist, so the profile endpoint could
 * change credentials without presenting the current one. It is absent here on
 * purpose; password changes go through POST /api/auth/password.
 */
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    biography: z.string().trim().max(2000).optional(),
    noteName: z.string().trim().min(1).max(200).optional(),
    noteSections: z.array(objectIdSchema).max(50).optional(),
    noteTags: z.array(objectIdSchema).max(50).optional(),
  })
  // Unknown keys are stripped by default; this rejects a body that carried
  // nothing usable rather than silently doing nothing.
  .refine(value => Object.keys(value).length > 0, { message: 'No updatable fields supplied' })

export const publicUserParamsSchema = z.object({ id: objectIdSchema })

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
