import { Router } from 'express'
import { validate, body } from '../../lib/validate'
import { requireAuth, currentUser } from '../../middleware/auth'
import { mailLimiter } from '../../middleware/rate-limit'
import { contactSchema } from './contact.schemas'
import { deliverContactMessage } from './contact.service'

export const contactRouter = Router()

/**
 * S1-04 — now authenticated and hard rate limited. The public complaint form
 * on the rendered pages keeps the same limiter without the auth requirement,
 * since it is the support channel for people who cannot sign in.
 */
contactRouter.post('/send', requireAuth, mailLimiter, validate({ body: contactSchema }), async (req, res) => {
  const user = currentUser(req)
  await deliverContactMessage(body(req, contactSchema), user.email)
  res.status(201).json({ message: 'sent' })
})
