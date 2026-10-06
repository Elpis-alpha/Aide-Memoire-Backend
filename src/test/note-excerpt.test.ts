import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, signUp } from './helpers'

const BODY = '<h2>Kick-off</h2><p>Agreed: ship the <strong>import</strong> first.</p>'

describe('note excerpts', () => {
  it('lists carry a plain-text excerpt and never the body', async () => {
    const { agent } = await signUp()
    await agent.post('/api/notes').send({ name: 'Untitled note', text: BODY }).expect(201)

    const list = await agent.get('/api/notes').expect(200)
    const note = list.body.items.find((n: { name: string }) => n.name === 'Untitled note')

    expect(note.excerpt).toBe('Kick-off Agreed: ship the import first.')
    expect(note.text).toBeUndefined()
  })

  it('search results carry it too', async () => {
    const { agent } = await signUp()
    await agent
      .post('/api/notes')
      .send({ name: 'Standup', description: 'weekly', text: BODY })
      .expect(201)

    const found = await agent.get('/api/notes/search').query({ q: 'standup' }).expect(200)

    expect(found.body.items[0].excerpt).toContain('ship the import')
    expect(found.body.items[0].text).toBeUndefined()
  })

  it('the tree carries it for filed and unfiled notes alike', async () => {
    const { agent } = await signUp()
    const section = await agent.post('/api/sections').send({ name: 'Work' }).expect(201)
    await agent
      .post('/api/notes')
      .send({ name: 'Filed', text: BODY, sections: [section.body._id] })
      .expect(201)
    await agent.post('/api/notes').send({ name: 'Loose', text: '<p>Unfiled body</p>' }).expect(201)

    const tree = await agent.get('/api/tree').expect(200)
    const work = tree.body.sections.find((s: { name: string }) => s.name === 'Work')
    const loose = tree.body.freeNotes.find((n: { name: string }) => n.name === 'Loose')

    expect(work.notes[0].excerpt).toBe('Kick-off Agreed: ship the import first.')
    expect(work.notes[0].text).toBeUndefined()
    expect(loose.excerpt).toBe('Unfiled body')
    expect(loose.text).toBeUndefined()
  })

  it('reads only the start of a very large body', async () => {
    const { agent } = await signUp()
    const huge = `<p>Opening words.</p>${'<p>filler filler filler</p>'.repeat(3000)}`
    await agent.post('/api/notes').send({ name: 'Huge', text: huge }).expect(201)

    const tree = await agent.get('/api/tree').expect(200)
    const note = tree.body.freeNotes.find((n: { name: string }) => n.name === 'Huge')

    expect(note.excerpt.startsWith('Opening words.')).toBe(true)
    expect(note.excerpt.length).toBeLessThanOrEqual(141)
  })

  it('an empty note has an empty excerpt', async () => {
    const { agent } = await signUp()
    await agent.post('/api/notes').send({ name: 'Blank' }).expect(201)

    const tree = await agent.get('/api/tree').expect(200)
    const blank = tree.body.freeNotes.find((n: { name: string }) => n.name === 'Blank')

    expect(blank.excerpt).toBe('')
  })

  it('does not widen what the public can see', async () => {
    const { agent } = await signUp()
    const created = await agent
      .post('/api/notes')
      .send({ name: 'Secret', text: '<p>private words</p>' })
      .expect(201)
    await agent.post(`/api/notes/${created.body._id}/toggle-public`).expect(200)

    const found = await request(app).get('/api/public/notes/search').query({ q: 'secret' }).expect(200)

    // A published note's excerpt is derived from text the public can already read.
    expect(found.body.items[0].excerpt).toBe('private words')
    expect(found.body.items[0].text).toBeUndefined()
  })
})
