import { Router, urlencoded } from 'express'
import { z } from 'zod'
import { env } from '../../config/env'
import { validate, body, params } from '../../lib/validate'
import { mailLimiter } from '../../middleware/rate-limit'
import { contactSchema } from '../contact/contact.schemas'
import { deliverContactMessage } from '../contact/contact.service'
import {
  checkVerificationToken,
  confirmVerification,
  deleteUnverifiedAccount,
} from '../auth/auth.service'

/**
 * The server-rendered pages the transactional emails link to, plus the public
 * complaint form. Everything else is JSON under /api.
 */
export const renderRouter = Router()

const base = {
  siteName: env.SITE_NAME,
  frontendLocation: env.FRONT_END_LOCATION,
  complainLink: '/complain',
}

const verifyParams = z.object({
  id: z.string().min(1).max(64),
  token: z.string().min(1).max(200),
})

renderRouter.get('/', (_req, res) => {
  res.render('index', { ...base, title: env.SITE_NAME })
})

renderRouter.get('/complain', (_req, res) => {
  res.render('complain', { ...base, title: `${env.SITE_NAME} | Complaint` })
})

/**
 * S1-04 — the unauthenticated half of the mail relay. Kept public because it
 * is the support channel for people who cannot sign in, but now validated,
 * length-capped, escaped and hard rate limited.
 */
renderRouter.post(
  '/accept-complaint',
  mailLimiter,
  urlencoded({ extended: true, limit: '32kb' }),
  validate({ body: contactSchema }),
  async (req, res) => {
    await deliverContactMessage(body(req, contactSchema))
    res.render('accept-complaint', { ...base, title: `${env.SITE_NAME} | Accepted` })
  },
)

renderRouter.get('/mail/welcome-mail/:id/:token', validate({ params: verifyParams }), async (req, res) => {
  const { id, token } = params(req, verifyParams)
  const user = await checkVerificationToken(id, token)

  res.render('mail/welcome-mail', {
    ...base,
    title: env.SITE_NAME,
    user: user.toJSON(),
    userString: JSON.stringify(user.toJSON()),
    verifyLink: `/mail/verify-user/${id}/${token}`,
    deleteLink: `/mail/delete-user/${id}/${token}`,
  })
})

renderRouter.get('/mail/verify-user/:id/:token', validate({ params: verifyParams }), async (req, res) => {
  const { id, token } = params(req, verifyParams)
  const user = await confirmVerification(id, token)

  res.render('mail/verify-user', {
    ...base,
    title: `${env.SITE_NAME} | Verify Email`,
    user: user.toJSON(),
    userString: JSON.stringify(user.toJSON()),
  })
})

renderRouter.get('/mail/delete-user/:id/:token', validate({ params: verifyParams }), async (req, res) => {
  const { id, token } = params(req, verifyParams)
  await deleteUnverifiedAccount(id, token)

  res.render('mail/delete-user', { ...base, title: `${env.SITE_NAME} | Delete Account` })
})
