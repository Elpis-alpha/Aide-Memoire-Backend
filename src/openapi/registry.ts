import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

import { changePasswordSchema, loginSchema, registerSchema } from '../modules/auth/auth.schemas'
import { createNoteSchema, updateNoteSchema } from '../modules/notes/notes.schemas'
import { createSectionSchema, updateSectionSchema } from '../modules/sections/sections.schemas'
import { createManyTagsSchema, createTagSchema } from '../modules/tags/tags.schemas'
import { updateProfileSchema } from '../modules/users/users.schemas'
import { contactSchema } from '../modules/contact/contact.schemas'
import { confirmAvatarSchema, signUploadSchema } from '../modules/media/media.schemas'

export const registry = new OpenAPIRegistry()

// ---- Shared components ----------------------------------------------------

const objectId = z.string().openapi({ example: '6aaf8226049dc1532aafadcb' })

const ErrorResponse = registry.register(
  'Error',
  z
    .object({
      error: z.string(),
      code: z.string(),
      details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    })
    .openapi('Error'),
)

const User = registry.register(
  'User',
  z
    .object({
      _id: objectId,
      name: z.string(),
      email: z.string().email(),
      biography: z.string().optional(),
      noteName: z.string(),
      noteSections: z.array(objectId),
      noteTags: z.array(objectId),
      emailVerifiedAt: z.string().datetime().nullable(),
      verified: z.boolean(),
      avatarUrl: z.string().url().nullable(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    })
    .openapi('User'),
)

const PublicProfile = registry.register(
  'PublicProfile',
  z
    .object({
      _id: objectId,
      name: z.string(),
      biography: z.string(),
      avatarUrl: z.string().url().nullable(),
      createdAt: z.string().datetime(),
    })
    .openapi('PublicProfile'),
)

const NamedRef = z.object({ _id: objectId, name: z.string() })

const Note = registry.register(
  'Note',
  z
    .object({
      _id: objectId,
      owner: objectId,
      name: z.string(),
      description: z.string(),
      text: z.string().optional(),
      sections: z.array(NamedRef),
      tags: z.array(NamedRef),
      canDelete: z.boolean(),
      isPublic: z.boolean(),
      specialName: z.string(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    })
    .openapi('Note'),
)

const Section = registry.register(
  'Section',
  z
    .object({
      _id: objectId,
      owner: objectId,
      name: z.string(),
      description: z.string(),
      isPublic: z.boolean(),
      open: z.boolean(),
      canDelete: z.boolean(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    })
    .openapi('Section'),
)

const Tag = registry.register(
  'Tag',
  z.object({ _id: objectId, name: z.string() }).openapi('Tag'),
)

/** Every list endpoint returns this shape (S2-17). */
const NotePage = registry.register(
  'NotePage',
  z
    .object({
      items: z.array(Note),
      nextCursor: z.string().nullable().openapi({ description: 'Pass back as ?cursor= for the next page' }),
    })
    .openapi('NotePage'),
)

const MessageResponse = registry.register(
  'Message',
  z.object({ message: z.string() }).openapi('Message'),
)

const cookieAuth = registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'am_access',
  description: 'httpOnly access-token cookie set by /api/auth/login (S1-07).',
})

// ---- Helpers --------------------------------------------------------------

const json = <T extends z.ZodTypeAny>(schema: T) => ({ 'application/json': { schema } })

const errors = (...codes: number[]) =>
  Object.fromEntries(
    codes.map(code => [
      code,
      {
        description:
          {
            400: 'Invalid request',
            401: 'Not authenticated',
            403: 'Forbidden',
            404: 'Not found',
            409: 'Conflict',
            429: 'Rate limited',
            503: 'Service unavailable',
          }[code] ?? 'Error',
        content: json(ErrorResponse),
      },
    ]),
  )

const idParam = z.object({ id: objectId })

const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
})

const secured = [{ [cookieAuth.name]: [] }]

// ---- Auth -----------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  tags: ['Auth'],
  summary: 'Create an account',
  description: 'Provisions the default sections and welcome note, and sends a verification email.',
  request: { body: { content: json(registerSchema) } },
  responses: {
    201: { description: 'Created', content: json(z.object({ user: User })) },
    ...errors(400, 409, 429),
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Auth'],
  summary: 'Sign in',
  request: { body: { content: json(loginSchema) } },
  responses: {
    200: { description: 'Signed in', content: json(z.object({ user: User })) },
    ...errors(400, 429),
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/refresh',
  tags: ['Auth'],
  summary: 'Rotate the session',
  description: 'Single-use rotation. Replaying a superseded token revokes every session for that user.',
  responses: {
    200: { description: 'Rotated', content: json(z.object({ user: User })) },
    ...errors(401),
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout',
  tags: ['Auth'],
  summary: 'Sign out of this session',
  responses: { 200: { description: 'Signed out', content: json(MessageResponse) } },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout-all',
  tags: ['Auth'],
  summary: 'Sign out everywhere',
  security: secured,
  responses: { 200: { description: 'Signed out', content: json(MessageResponse) }, ...errors(401) },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/password',
  tags: ['Auth'],
  summary: 'Change password',
  description: 'Revokes every other session; tokens minted before the change stop working (S1-08).',
  security: secured,
  request: { body: { content: json(changePasswordSchema) } },
  responses: {
    200: { description: 'Changed', content: json(MessageResponse) },
    ...errors(400, 401, 429),
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/auth/verify/request',
  tags: ['Auth'],
  summary: 'Send a fresh verification email',
  security: secured,
  responses: {
    200: { description: 'Sent', content: json(MessageResponse) },
    ...errors(401, 409, 429),
  },
})

// ---- Users ----------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/users/me',
  tags: ['Users'],
  summary: 'The signed-in account',
  security: secured,
  responses: { 200: { description: 'OK', content: json(User) }, ...errors(401) },
})

registry.registerPath({
  method: 'patch',
  path: '/api/users/me',
  tags: ['Users'],
  summary: 'Update the signed-in account',
  description: 'Password is deliberately not updatable here — use /api/auth/password (S1-08).',
  security: secured,
  request: { body: { content: json(updateProfileSchema) } },
  responses: { 200: { description: 'Updated', content: json(User) }, ...errors(400, 401) },
})

registry.registerPath({
  method: 'delete',
  path: '/api/users/me',
  tags: ['Users'],
  summary: 'Delete the account and all of its content',
  security: secured,
  responses: { 200: { description: 'Deleted', content: json(MessageResponse) }, ...errors(401) },
})

registry.registerPath({
  method: 'get',
  path: '/api/users/{id}',
  tags: ['Users'],
  summary: 'Public profile',
  description: 'Carries no email address. The email lookup and existence oracle were removed (S1-02, S3-10).',
  request: { params: idParam },
  responses: { 200: { description: 'OK', content: json(PublicProfile) }, ...errors(404) },
})

// ---- Notes ----------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/api/notes',
  tags: ['Notes'],
  summary: 'Create a note',
  security: secured,
  request: { body: { content: json(createNoteSchema) } },
  responses: { 201: { description: 'Created', content: json(Note) }, ...errors(400, 401, 404) },
})

registry.registerPath({
  method: 'get',
  path: '/api/notes',
  tags: ['Notes'],
  summary: 'List your notes',
  security: secured,
  request: { query: paginationQuery },
  responses: { 200: { description: 'OK', content: json(NotePage) }, ...errors(401) },
})

registry.registerPath({
  method: 'get',
  path: '/api/notes/search',
  tags: ['Notes'],
  summary: 'Search your notes',
  description: 'Backed by a text index rather than an unescaped regex (S1-09).',
  security: secured,
  request: { query: paginationQuery.extend({ q: z.string() }) },
  responses: { 200: { description: 'OK', content: json(NotePage) }, ...errors(400, 401) },
})

registry.registerPath({
  method: 'get',
  path: '/api/notes/free',
  tags: ['Notes'],
  summary: 'Notes not filed under any section',
  security: secured,
  request: { query: paginationQuery },
  responses: { 200: { description: 'OK', content: json(NotePage) }, ...errors(401) },
})

registry.registerPath({
  method: 'get',
  path: '/api/notes/{id}',
  tags: ['Notes'],
  summary: 'Read one of your notes',
  security: secured,
  request: { params: idParam },
  responses: { 200: { description: 'OK', content: json(Note) }, ...errors(401, 404) },
})

registry.registerPath({
  method: 'patch',
  path: '/api/notes/{id}',
  tags: ['Notes'],
  summary: 'Update a note',
  security: secured,
  request: { params: idParam, body: { content: json(updateNoteSchema) } },
  responses: { 200: { description: 'Updated', content: json(Note) }, ...errors(400, 401, 404) },
})

registry.registerPath({
  method: 'delete',
  path: '/api/notes/{id}',
  tags: ['Notes'],
  summary: 'Delete a note',
  security: secured,
  request: { params: idParam },
  responses: { 200: { description: 'Deleted', content: json(MessageResponse) }, ...errors(401, 404) },
})

registry.registerPath({
  method: 'post',
  path: '/api/notes/{id}/toggle-public',
  tags: ['Notes'],
  summary: 'Flip a note between public and private',
  security: secured,
  request: { params: idParam },
  responses: {
    200: { description: 'Toggled', content: json(z.object({ isPublic: z.boolean() })) },
    ...errors(401, 404),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/tree',
  tags: ['Notes'],
  summary: 'The whole sidebar in one request',
  description: 'One aggregation replacing the per-section fan-out (S2-23).',
  security: secured,
  responses: {
    200: {
      description: 'OK',
      content: json(
        z.object({
          sections: z.array(Section.extend({ notes: z.array(Note.partial()) })),
          freeNotes: z.array(Note.partial()),
        }),
      ),
    },
    ...errors(401),
  },
})

// ---- Sections -------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/api/sections',
  tags: ['Sections'],
  summary: 'Create a section',
  security: secured,
  request: { body: { content: json(createSectionSchema) } },
  responses: { 201: { description: 'Created', content: json(Section) }, ...errors(400, 401) },
})

registry.registerPath({
  method: 'get',
  path: '/api/sections',
  tags: ['Sections'],
  summary: 'List your sections',
  security: secured,
  responses: { 200: { description: 'OK', content: json(z.array(Section)) }, ...errors(401) },
})

registry.registerPath({
  method: 'patch',
  path: '/api/sections/{id}',
  tags: ['Sections'],
  summary: 'Update a section',
  security: secured,
  request: { params: idParam, body: { content: json(updateSectionSchema) } },
  responses: { 200: { description: 'Updated', content: json(Section) }, ...errors(400, 401, 404) },
})

registry.registerPath({
  method: 'delete',
  path: '/api/sections/{id}',
  tags: ['Sections'],
  summary: 'Delete a section',
  description: 'Also pulls the reference out of every note that used it (S2-15).',
  security: secured,
  request: { params: idParam },
  responses: { 200: { description: 'Deleted', content: json(MessageResponse) }, ...errors(401, 404) },
})

// ---- Tags -----------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/api/tags',
  tags: ['Tags'],
  summary: 'Create a tag',
  description: 'Authenticated and rate limited — this was open to anyone (S1-06).',
  security: secured,
  request: { body: { content: json(createTagSchema) } },
  responses: { 201: { description: 'Created', content: json(Tag) }, ...errors(400, 401, 429) },
})

registry.registerPath({
  method: 'post',
  path: '/api/tags/bulk',
  tags: ['Tags'],
  summary: 'Create many tags',
  security: secured,
  request: { body: { content: json(createManyTagsSchema) } },
  responses: {
    201: {
      description: 'Created',
      content: json(z.object({ message: z.string(), requested: z.number(), saved: z.number() })),
    },
    ...errors(400, 401, 429),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/tags/search',
  tags: ['Tags'],
  summary: 'Prefix search over tags',
  request: { query: z.object({ prefix: z.string(), limit: z.coerce.number().optional() }) },
  responses: { 200: { description: 'OK', content: json(z.array(Tag)) }, ...errors(400) },
})

// ---- Public ---------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/public/notes/{id}',
  tags: ['Public'],
  summary: 'Read a public note',
  request: { params: idParam },
  responses: { 200: { description: 'OK', content: json(Note) }, ...errors(404) },
})

registry.registerPath({
  method: 'get',
  path: '/api/public/notes/search',
  tags: ['Public'],
  summary: 'Search public notes',
  request: { query: paginationQuery.extend({ q: z.string() }) },
  responses: { 200: { description: 'OK', content: json(NotePage) }, ...errors(400) },
})

registry.registerPath({
  method: 'get',
  path: '/api/public/sections/{id}',
  tags: ['Public'],
  summary: 'Read a public section',
  request: { params: idParam },
  responses: { 200: { description: 'OK', content: json(Section) }, ...errors(404) },
})

registry.registerPath({
  method: 'get',
  path: '/api/public/sections/{id}/notes',
  tags: ['Public'],
  summary: 'List the public notes in a public section',
  description:
    'Returns only notes that are themselves public. Both gates are required — the section alone used to be enough (S1-03).',
  request: { params: idParam, query: paginationQuery },
  responses: { 200: { description: 'OK', content: json(NotePage) }, ...errors(404) },
})

registry.registerPath({
  method: 'get',
  path: '/api/public/sections/{sectionId}/notes/{noteId}',
  tags: ['Public'],
  summary: 'Read one public note within a public section',
  request: { params: z.object({ sectionId: objectId, noteId: objectId }) },
  responses: {
    200: { description: 'OK', content: json(z.object({ section: Section, note: Note })) },
    ...errors(404),
  },
})

// ---- Media ----------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/api/media/sign',
  tags: ['Media'],
  summary: 'Signature for a direct browser upload to Cloudinary',
  description: 'Image bytes never pass through the API, which is what let sharp be removed.',
  security: secured,
  request: { body: { content: json(signUploadSchema) } },
  responses: {
    200: {
      description: 'OK',
      content: json(
        z.object({
          timestamp: z.number(),
          signature: z.string(),
          apiKey: z.string(),
          cloudName: z.string(),
          folder: z.string(),
          uploadUrl: z.string().url(),
        }),
      ),
    },
    ...errors(400, 401, 503),
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/media/avatar',
  tags: ['Media'],
  summary: 'Record an uploaded avatar',
  security: secured,
  request: { body: { content: json(confirmAvatarSchema) } },
  responses: {
    200: { description: 'Saved', content: json(z.object({ avatarUrl: z.string().url().nullable() })) },
    ...errors(400, 401),
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/media/avatar',
  tags: ['Media'],
  summary: 'Remove the avatar',
  security: secured,
  responses: { 200: { description: 'Removed', content: json(MessageResponse) }, ...errors(401) },
})

// ---- Contact & health -----------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/api/mail/send',
  tags: ['Contact'],
  summary: 'Message the site owner',
  description: 'Authenticated, length-capped, escaped and hard rate limited (S1-04).',
  security: secured,
  request: { body: { content: json(contactSchema) } },
  responses: {
    201: { description: 'Sent', content: json(MessageResponse) },
    ...errors(400, 401, 429, 503),
  },
})

registry.registerPath({
  method: 'get',
  path: '/healthz',
  tags: ['Health'],
  summary: 'Liveness — does not touch the database',
  responses: {
    200: {
      description: 'Alive',
      content: json(z.object({ status: z.literal('ok'), uptime: z.number() })),
    },
  },
})

registry.registerPath({
  method: 'get',
  path: '/readyz',
  tags: ['Health'],
  summary: 'Readiness — should this instance receive traffic',
  responses: {
    200: {
      description: 'Ready',
      content: json(z.object({ status: z.string(), checks: z.object({ mongo: z.string() }) })),
    },
    503: { description: 'Not ready', content: json(z.object({ status: z.string() })) },
  },
})
