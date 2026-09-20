import request from 'supertest'
import type { App } from 'supertest/types'
import { createApp } from '../app'

export const app = createApp() as unknown as App

export type Session = {
  agent: ReturnType<typeof request.agent>
  userId: string
  email: string
}

let counter = 0

/** Registers a user and returns an agent holding that session's cookies. */
export const signUp = async (overrides: Partial<{ name: string; email: string; password: string }> = {}): Promise<Session> => {
  counter += 1
  const email = overrides.email ?? `user${counter}@example.com`
  const password = overrides.password ?? 'correct-horse-9'

  const agent = request.agent(app)
  const response = await agent
    .post('/api/auth/register')
    .send({ name: overrides.name ?? `User ${counter}`, email, password })
    .expect(201)

  return { agent, userId: response.body.user._id, email }
}
