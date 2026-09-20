import { z } from 'zod'

/**
 * S1-04 — `POST /api/mail/send` had no auth, no rate limit and no validation,
 * and passed `req.body.content` through as raw HTML on the site's own Gmail
 * account. Length is capped here; the content is escaped in the service.
 */
export const contactSchema = z.object({
  title: z.string().trim().min(1, 'A subject is required').max(200),
  content: z.string().trim().min(1, 'A message is required').max(5000),
})

export type ContactInput = z.infer<typeof contactSchema>
