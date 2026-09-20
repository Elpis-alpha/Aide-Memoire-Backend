import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, signUp } from './helpers'

/**
 * The regression suite for S1-03: a public section used to expose every note
 * filed under it, including the private ones, to anonymous callers. These are
 * the assertions that would have caught it.
 */
describe('public/private boundary', () => {
  const setup = async () => {
    const { agent } = await signUp()

    const section = await agent.post('/api/sections').send({ name: 'Shared' }).expect(201)
    const sectionId = section.body._id
    await agent.post(`/api/sections/${sectionId}/toggle-public`).expect(200)

    const open = await agent
      .post('/api/notes')
      .send({ name: 'Open note', text: '<p>public body</p>', sections: [sectionId] })
      .expect(201)
    await agent.post(`/api/notes/${open.body._id}/toggle-public`).expect(200)

    const secret = await agent
      .post('/api/notes')
      .send({ name: 'Secret note', text: '<p>secret body</p>', sections: [sectionId] })
      .expect(201)

    return { agent, sectionId, publicId: open.body._id, privateId: secret.body._id }
  }

  it('lists only public notes from a public section', async () => {
    const { sectionId } = await setup()

    const response = await request(app).get(`/api/public/sections/${sectionId}/notes`).expect(200)

    const names = response.body.items.map((n: { name: string }) => n.name)
    expect(names).toEqual(['Open note'])
    expect(names).not.toContain('Secret note')
  })

  it('refuses a private note requested through its public section', async () => {
    const { sectionId, privateId, publicId } = await setup()

    await request(app).get(`/api/public/sections/${sectionId}/notes/${privateId}`).expect(404)
    await request(app).get(`/api/public/sections/${sectionId}/notes/${publicId}`).expect(200)
  })

  it('refuses a private note requested directly', async () => {
    const { privateId, publicId } = await setup()

    await request(app).get(`/api/public/notes/${privateId}`).expect(404)
    await request(app).get(`/api/public/notes/${publicId}`).expect(200)
  })

  it('does not reach notes through a section that is not public', async () => {
    const { agent } = await signUp()

    const section = await agent.post('/api/sections').send({ name: 'Closed' }).expect(201)
    const note = await agent
      .post('/api/notes')
      .send({ name: 'Inside', text: '<p>x</p>', sections: [section.body._id] })
      .expect(201)
    // Public note, private section — the section gate must still hold.
    await agent.post(`/api/notes/${note.body._id}/toggle-public`).expect(200)

    await request(app).get(`/api/public/sections/${section.body._id}/notes`).expect(404)
    await request(app).get(`/api/public/sections/${section.body._id}`).expect(404)
  })

  it('keeps private notes out of public search', async () => {
    const { agent } = await signUp()

    const secret = await agent
      .post('/api/notes')
      .send({ name: 'Zebra confidential', text: '<p>x</p>' })
      .expect(201)
    const open = await agent
      .post('/api/notes')
      .send({ name: 'Zebra published', text: '<p>x</p>' })
      .expect(201)
    await agent.post(`/api/notes/${open.body._id}/toggle-public`).expect(200)

    const response = await request(app).get('/api/public/notes/search?q=Zebra').expect(200)
    const ids = response.body.items.map((n: { _id: string }) => n._id)

    expect(ids).toContain(open.body._id)
    expect(ids).not.toContain(secret.body._id)
  })

  it('exposes no email address on a public profile', async () => {
    const { userId, email } = await signUp({ email: 'private@example.com' })

    const response = await request(app).get(`/api/users/${userId}`).expect(200)

    expect(response.body.email).toBeUndefined()
    expect(JSON.stringify(response.body)).not.toContain(email)
  })

  it('has removed the email lookup and existence oracle entirely', async () => {
    await signUp({ email: 'oracle@example.com' })

    await request(app).get('/api/users/email/oracle@example.com').expect(404)
    await request(app).get('/api/users/user/exists?email=oracle@example.com').expect(404)
    await request(app).post('/api/to-img/pic').expect(404)
  })

  it('requires authentication for tag writes', async () => {
    await request(app).post('/api/tags').send({ name: 'anon' }).expect(401)
    await request(app).post('/api/tags/bulk').send({ names: ['a'] }).expect(401)
  })
})
