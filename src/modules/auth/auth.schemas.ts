import { z } from 'zod'

/**
 * The old rule was `minlength: 7` plus "must not contain the word password".
 * The length floor is raised and the substring rule kept, since it is cheap
 * and rules out the single most common choice.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password must be at most 200 characters')
  .refine(value => !value.toLowerCase().includes('password'), {
    message: 'Password must not contain "password"',
  })

export const emailSchema = z.string().trim().toLowerCase().email('Email is invalid').max(254)

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
})

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
})

export const verifyTokenSchema = z.object({
  token: z.string().min(1).max(200),
})

export const verifyParamsSchema = z.object({
  id: z.string().min(1).max(64),
  token: z.string().min(1).max(200),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
