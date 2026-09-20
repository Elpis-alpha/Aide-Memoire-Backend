import { z } from 'zod'
import { Types } from 'mongoose'

/** Rejects malformed ids at the boundary instead of letting Mongoose throw. */
export const objectIdSchema = z
  .string()
  .refine(value => Types.ObjectId.isValid(value), { message: 'Invalid id' })
  .transform(value => new Types.ObjectId(value))

export const idParamSchema = z.object({ id: objectIdSchema })
