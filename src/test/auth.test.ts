import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, signUp } from './helpers'

describe('auth', () => {
  it('registers a user, sets httpOnly cookies and provisions the welcome content', async () => {
    const agent = request.agent(app)

    const response = await agent
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'correct-horse-9' })
      .expect(201)

    expect(response.body.user.email).toBe('ada@example.com')
    // The hash must never reach the client.
    expect(response.body.user.password).toBeUndefined()
    expect(response.body.user.verified).toBe(false)

    const cookies = response.headers['set-cookie'] as unknown as string[]
    expect(cookies.some(c => c.startsWith('am_access=') && c.includes('HttpOnly'))).toBe(true)
    expect(cookies.some(c => c.startsWith('am_refresh=') && c.includes('HttpOnly'))).toBe(true)

    const tree = await agent.get('/api/tree').expect(200)
    expect(tree.body.sections.map((s: { name: string }) => s.name).sort()).toEqual([
      'Favorite',
      'Important',
    ])
    expect(tree.body.freeNotes).toHaveLength(1)
    expect(tree.body.freeNotes[0].name).toBe('Welcome')
  })

  it('rejects a duplicate email', async () => {
    await signUp({ email: 'dupe@example.com' })

    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'dupe@example.com', password: 'correct-horse-9' })
      .expect(409)
  })

  it('rejects a weak password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Weak', email: 'weak@example.com', password: 'password123' })
      .expect(400)
  })

  it('logs in and out', async () => {
    const { email } = await signUp({ email: 'inout@example.com' })
    const agent = request.agent(app)

    await agent.post('/api/auth/login').send({ email, password: 'correct-horse-9' }).expect(200)
    await agent.get('/api/users/me').expect(200)

    await agent.post('/api/auth/logout').expect(200)
    await agent.get('/api/users/me').expect(401)
  })

  it('gives the same answer for a wrong password and an unknown account', async () => {
    const { email } = await signUp({ email: 'known@example.com' })

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'not-the-password' })
      .expect(400)

    const unknownAccount = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'not-the-password' })
      .expect(400)

    // Distinguishable responses would confirm which addresses are registered.
    expect(wrongPassword.body.error).toBe(unknownAccount.body.error)
  })

  it('refuses an unauthenticated request for the current user', async () => {
    await request(app).get('/api/users/me').expect(401)
  })

  it('rotates the refresh token and revokes the family when one is replayed', async () => {
    const agent = request.agent(app)
    await agent
      .post('/api/auth/register')
      .send({ name: 'Rotate', email: 'rotate@example.com', password: 'correct-horse-9' })
      .expect(201)

    const first = await agent.post('/api/auth/refresh').expect(200)
    const stolen = (first.headers['set-cookie'] as unknown as string[]).find(c =>
      c.startsWith('am_refresh='),
    ) as string

    await agent.post('/api/auth/refresh').expect(200)

    // Presenting the superseded token means a leak, so every session dies.
    await request(app).post('/api/auth/refresh').set('Cookie', stolen).expect(401)
    await agent.post('/api/auth/refresh').expect(401)
  })

  it('does not accept a profile update that tries to set a password or verification state', async () => {
    const { agent } = await signUp({ email: 'massassign@example.com' })

    const response = await agent
      .patch('/api/users/me')
      .send({ name: 'Renamed', password: 'hijacked-9', emailVerifiedAt: '2020-01-01T00:00:00Z' })
      .expect(200)

    expect(response.body.name).toBe('Renamed')
    expect(response.body.emailVerifiedAt).toBeNull()

    // The original password still works, so the injected one was ignored.
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'massassign@example.com', password: 'correct-horse-9' })
      .expect(200)
  })

  it('removes the account and everything under it', async () => {
    const { agent } = await signUp({ email: 'gone@example.com' })

    await agent.delete('/api/users/me').expect(200)
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'gone@example.com', password: 'correct-horse-9' })
      .expect(400)
  })
})
