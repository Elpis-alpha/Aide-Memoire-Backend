import { z } from 'zod'

export const signUploadSchema = z.object({
  /** Which logical bucket the asset belongs to; keeps folders predictable. */
  kind: z.enum(['avatar', 'note-image']),
})

/**
 * Cloudinary returns these after a successful direct upload; the client hands
 * them back so the URL can be recorded against the account.
 */
export const confirmAvatarSchema = z.object({
  publicId: z.string().trim().min(1).max(300),
  url: z.string().url().max(2000),
})
