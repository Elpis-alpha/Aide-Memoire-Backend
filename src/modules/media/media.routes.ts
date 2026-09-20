import { Router } from 'express'
import { validate, body } from '../../lib/validate'
import { requireAuth, currentUser } from '../../middleware/auth'
import { writeLimiter } from '../../middleware/rate-limit'
import { confirmAvatarSchema, signUploadSchema } from './media.schemas'
import { assertOwnedAsset, destroyAsset, signUpload } from './media.service'

export const mediaRouter = Router()

mediaRouter.use(requireAuth)

mediaRouter.post('/sign', writeLimiter, validate({ body: signUploadSchema }), (req, res) => {
  const user = currentUser(req)
  const { kind } = body(req, signUploadSchema)
  res.json(signUpload(kind, user._id.toString()))
})

mediaRouter.post('/avatar', writeLimiter, validate({ body: confirmAvatarSchema }), async (req, res) => {
  const user = currentUser(req)
  const { publicId, url } = body(req, confirmAvatarSchema)

  assertOwnedAsset(publicId, 'avatar', user._id.toString())

  const previous = user.avatarPublicId
  user.avatarUrl = url
  user.avatarPublicId = publicId
  await user.save()

  if (previous && previous !== publicId) await destroyAsset(previous)

  res.json({ avatarUrl: user.avatarUrl })
})

mediaRouter.delete('/avatar', async (req, res) => {
  const user = currentUser(req)
  const previous = user.avatarPublicId

  user.avatarUrl = null
  user.avatarPublicId = null
  await user.save()

  if (previous) await destroyAsset(previous)

  res.json({ message: 'avatar removed' })
})
