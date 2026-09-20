import type { RequestHandler } from 'express'
import { AppError } from '../../lib/errors'
import { body, params } from '../../lib/validate'
import { currentUser } from '../../middleware/auth'
import { clearAuthCookies } from '../../lib/tokens'
import { User } from '../../models/user.model'
import { publicUserParamsSchema, updateProfileSchema } from './users.schemas'
import { deleteAccount, toPublicProfile, updateProfile } from './users.service'

export const getMe: RequestHandler = async (req, res) => {
  res.json(currentUser(req))
}

export const patchMe: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const input = body(req, updateProfileSchema)
  const updated = await updateProfile(user, input)
  res.json(updated)
}

export const deleteMe: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  await deleteAccount(user._id, user.email, user.name)
  clearAuthCookies(res)
  res.json({ message: 'user deleted' })
}

/**
 * Public profile by id. The old `GET /api/users/email/:email` (S1-02) and
 * `GET /api/users/user/exists` (S3-10) are gone — between them they formed an
 * unauthenticated email-to-account lookup and a registration oracle.
 */
export const getPublicProfile: RequestHandler = async (req, res) => {
  const { id } = params(req, publicUserParamsSchema)

  const user = await User.findById(id)
  if (!user) throw AppError.notFound()

  res.json(toPublicProfile(user))
}
