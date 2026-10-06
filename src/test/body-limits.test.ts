import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, signUp } from './helpers'

/**
 * The app-wide JSON parser is capped at 100kb and the note routes raise that to
 * 5mb for themselves. Before this was pinned, the global parser ran first, so a
 * note body over ~100kb was rejected before the route's own parser ever saw it
 * — and the error handler had no case for body-parser errors, so the refusal
 * went out as a generic 500.
 */
describe('request body limits', () => {
  const paragraphs = (bytes: number) => `<p>${'a'.repeat(bytes)}</p>`

  it('saves a note body well over the 100kb default', async () => {
    const { agent } = await signUp()

    const created = await agent.post('/api/notes').send({ name: 'Long' }).expect(201)
    const body = paragraphs(300_000)

    const saved = await agent.patch(`/api/notes/${created.body._id}`).send({ text: body }).expect(200)
    expect(saved.body.text.length).toBeGreaterThan(299_000)

    await agent.post('/api/notes').send({ name: 'Long, on create', text: body }).expect(201)
  })

  it('answers a note body over the 5mb ceiling with 413, not 500', async () => {
    const { agent } = await signUp()
    const created = await agent.post('/api/notes').send({ name: 'Too long' }).expect(201)

    const res = await agent
      .patch(`/api/notes/${created.body._id}`)
      .send({ text: paragraphs(5_300_000) })
      .expect(413)

    expect(res.body.code).toBe('payload_too_large')
  })

  it('still holds every other endpoint to the 100kb default', async () => {
    const { agent } = await signUp()

    const res = await agent
      .post('/api/sections')
      .send({ name: 'Big', description: 'a'.repeat(150_000) })
      .expect(413)

    expect(res.body.code).toBe('payload_too_large')
  })

  it('answers malformed JSON with 400, not 500', async () => {
    const { agent } = await signUp()

    const res = await agent
      .post('/api/notes')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400)

    expect(res.body.code).toBe('bad_request')
  })

  it('does not read a large note body from a caller who is not signed in', async () => {
    // No cookie. Had the 5mb parser run before auth, this would be parsed or
    // refused as too large; it has to be a plain 401.
    await request(app)
      .patch('/api/notes/000000000000000000000000')
      .send({ text: paragraphs(4_000_000) })
      .expect(401)
  })
})
