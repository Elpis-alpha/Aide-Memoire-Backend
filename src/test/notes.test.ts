import { describe, expect, it } from 'vitest'
import { signUp } from './helpers'

describe('note ownership', () => {
  it('creates, reads, updates and deletes a note', async () => {
    const { agent } = await signUp()

    const created = await agent
      .post('/api/notes')
      .send({ name: 'First', text: '<p>body</p>' })
      .expect(201)

    const id = created.body._id
    expect(created.body.name).toBe('First')

    await agent.get(`/api/notes/${id}`).expect(200)

    const updated = await agent.patch(`/api/notes/${id}`).send({ name: 'Renamed' }).expect(200)
    expect(updated.body.name).toBe('Renamed')

    await agent.delete(`/api/notes/${id}`).expect(200)
    await agent.get(`/api/notes/${id}`).expect(404)
  })

  it('never lets one account touch another account\'s note', async () => {
    const owner = await signUp()
    const stranger = await signUp()

    const created = await owner.agent
      .post('/api/notes')
      .send({ name: 'Mine', text: '<p>mine</p>' })
      .expect(201)

    const id = created.body._id

    // Every verb, so a gap in one of them cannot pass unnoticed.
    await stranger.agent.get(`/api/notes/${id}`).expect(404)
    await stranger.agent.patch(`/api/notes/${id}`).send({ name: 'Hijacked' }).expect(404)
    await stranger.agent.post(`/api/notes/${id}/toggle-public`).expect(404)
    await stranger.agent.delete(`/api/notes/${id}`).expect(404)

    // And the owner's copy is untouched.
    const after = await owner.agent.get(`/api/notes/${id}`).expect(200)
    expect(after.body.name).toBe('Mine')
  })

  it('does not list another account\'s notes', async () => {
    const owner = await signUp()
    const stranger = await signUp()

    await owner.agent.post('/api/notes').send({ name: 'Secret', text: '<p>x</p>' }).expect(201)

    const listed = await stranger.agent.get('/api/notes').expect(200)
    const names = listed.body.items.map((n: { name: string }) => n.name)
    expect(names).not.toContain('Secret')
  })

  it('refuses to file a note under a section owned by someone else', async () => {
    const owner = await signUp()
    const stranger = await signUp()

    const section = await owner.agent.post('/api/sections').send({ name: 'Theirs' }).expect(201)

    await stranger.agent
      .post('/api/notes')
      .send({ name: 'Intruder', text: '<p>x</p>', sections: [section.body._id] })
      .expect(404)
  })

  it('strips script and event handlers from note bodies', async () => {
    const { agent } = await signUp()

    const created = await agent
      .post('/api/notes')
      .send({
        name: 'XSS',
        text: '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">c</a>',
      })
      .expect(201)

    expect(created.body.text).not.toContain('<script')
    expect(created.body.text).not.toContain('onerror')
    expect(created.body.text).not.toContain('javascript:')
    expect(created.body.text).toContain('<p>ok</p>')
  })

  it('paginates rather than returning everything', async () => {
    const { agent } = await signUp()

    for (let i = 0; i < 5; i += 1) {
      await agent.post('/api/notes').send({ name: `Note ${i}`, text: '<p>x</p>' }).expect(201)
    }

    const first = await agent.get('/api/notes?limit=2').expect(200)
    expect(first.body.items).toHaveLength(2)
    expect(first.body.nextCursor).toBeTruthy()

    const second = await agent.get(`/api/notes?limit=2&cursor=${first.body.nextCursor}`).expect(200)
    expect(second.body.items).toHaveLength(2)

    const firstIds = first.body.items.map((n: { _id: string }) => n._id)
    const secondIds = second.body.items.map((n: { _id: string }) => n._id)
    expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false)
  })

  it('pulls the reference out of its notes when a section is deleted', async () => {
    const { agent } = await signUp()

    const section = await agent.post('/api/sections').send({ name: 'Temp' }).expect(201)
    const note = await agent
      .post('/api/notes')
      .send({ name: 'Filed', text: '<p>x</p>', sections: [section.body._id] })
      .expect(201)

    await agent.delete(`/api/sections/${section.body._id}`).expect(200)

    // S2-15 — this used to leave a dangling {_id, name} copy behind.
    const after = await agent.get(`/api/notes/${note.body._id}`).expect(200)
    expect(after.body.sections).toHaveLength(0)
  })

  it('reflects a section rename without stale copies', async () => {
    const { agent } = await signUp()

    const section = await agent.post('/api/sections').send({ name: 'Before' }).expect(201)
    const note = await agent
      .post('/api/notes')
      .send({ name: 'Filed', text: '<p>x</p>', sections: [section.body._id] })
      .expect(201)

    await agent.patch(`/api/sections/${section.body._id}`).send({ name: 'After' }).expect(200)

    const after = await agent.get(`/api/notes/${note.body._id}`).expect(200)
    expect(after.body.sections[0].name).toBe('After')
  })
})
