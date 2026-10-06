import { describe, expect, it } from 'vitest'
import { Note } from '../models/note.model'
import { Section } from '../models/section.model'
import { refreshWelcomeContent } from '../scripts/refresh-welcome-content'
import { signUp } from './helpers'

const FRONTEND = 'https://app.example.test'
const LEGACY_TEXT = '<p>Thanks! try hitting these tiny stars floating around.</p>'

/** Rewinds one account to what a pre-rewrite signup left behind. */
const makeLegacy = async (userId: string) => {
  await Note.updateOne({ owner: userId, specialName: 'welcome' }, { text: LEGACY_TEXT, description: '' })
  await Section.updateOne(
    { owner: userId, name: 'Favorite' },
    { description: 'A special section for keeping special (favored) notes.' },
  )
}

describe('refreshWelcomeContent', () => {
  it('reports without writing on a dry run', async () => {
    const { userId } = await signUp()
    await makeLegacy(userId)

    const result = await refreshWelcomeContent(FRONTEND, { apply: false })

    expect(result).toMatchObject({ applied: false })
    expect(result.notes).toBeGreaterThanOrEqual(1)
    expect((await Note.findOne({ owner: userId, specialName: 'welcome' }))?.text).toBe(LEGACY_TEXT)
  })

  it('rewrites an untouched old welcome note and old section copy', async () => {
    const { userId } = await signUp()
    await makeLegacy(userId)

    await refreshWelcomeContent(FRONTEND, { apply: true })

    const note = await Note.findOne({ owner: userId, specialName: 'welcome' })
    expect(note?.text).toContain('two-minute tour')
    expect(note?.text).toContain(`${FRONTEND}/settings`)
    expect(note?.description).not.toBe('')
    expect((await Section.findOne({ owner: userId, name: 'Favorite' }))?.description).toBe(
      'Notes you want close at hand.',
    )
  })

  it('leaves a welcome note alone once its owner has rewritten it', async () => {
    const { userId } = await signUp()
    await Note.updateOne({ owner: userId, specialName: 'welcome' }, { text: '<p>My own words.</p>' })

    await refreshWelcomeContent(FRONTEND, { apply: true })

    expect((await Note.findOne({ owner: userId, specialName: 'welcome' }))?.text).toBe(
      '<p>My own words.</p>',
    )
  })

  it('is idempotent', async () => {
    const { userId } = await signUp()
    await makeLegacy(userId)

    await refreshWelcomeContent(FRONTEND, { apply: true })
    const second = await refreshWelcomeContent(FRONTEND, { apply: true })

    expect(second).toMatchObject({ notes: 0, sections: 0 })
  })
})
