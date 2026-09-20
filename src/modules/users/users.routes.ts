import { Router } from 'express'
import { validate } from '../../lib/validate'
import { requireAuth } from '../../middleware/auth'
import { writeLimiter } from '../../middleware/rate-limit'
import { publicUserParamsSchema, updateProfileSchema } from './users.schemas'
import { deleteMe, getMe, getPublicProfile, patchMe } from './users.controller'

export const usersRouter = Router()

usersRouter.get('/me', requireAuth, getMe)
usersRouter.patch('/me', requireAuth, writeLimiter, validate({ body: updateProfileSchema }), patchMe)
usersRouter.delete('/me', requireAuth, deleteMe)

usersRouter.get('/:id', validate({ params: publicUserParamsSchema }), getPublicProfile)
