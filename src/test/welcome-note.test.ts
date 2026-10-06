import { describe, expect, it } from 'vitest'
import { sanitizeNoteHtml } from '../lib/sanitize'
import { welcomeNote } from '../mail/note-templates'
import { signUp } from './helpers'

const FRONTEND = 'https://app.example.test'

describe('welcome note template', () => {
  const html = welcomeNote(FRONTEND)

  it('survives the sanitiser unchanged, so what is stored is what is shown', () => {
    expect(sanitizeNoteHtml(html)).toBe(html)
  })

  it('uses real headings, below the note title which is the page heading', () => {
    expect(html).not.toMatch(/<h1[\s>]/)
    expect(html).toMatch(/<h2>/)
  })

  it('carries no inline styles or spacer paragraphs — the editor discards the former', () => {
    expect(html).not.toMatch(/style=/)
    expect(html).not.toContain('<p></p>')
  })

  it('demonstrates sub- and superscript with the actual tags', () => {
    expect(html).toMatch(/<sup>[^<]+<\/sup>/)
    expect(html).toMatch(/H<sub>2<\/sub>O/)
  })

  it('only mentions features the app has', () => {
    // These were advertised by the 2022 version and do not exist any more.
    for (const gone of ['stars', 'Emoji Tab', 'Default Note Settings', 'font-family', 'Colored']) {
      expect(html).not.toContain(gone)
    }
  })

  it('links only to pages that exist and have no side effects', () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1] ?? '')

    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) expect(href.startsWith(`${FRONTEND}/`)).toBe(true)
    // Opening this route used to create a note.
    expect(hrefs).not.toContain(`${FRONTEND}/note/create-new`)
  })

  it('does not depend on an image served from the API host', () => {
    expect(html).not.toContain('<img')
  })
})

describe('provisioned content', () => {
  it('gives the welcome note a description and the default sections plain copy', async () => {
    const { agent } = await signUp()

    const tree = await agent.get('/api/tree').expect(200)
    const welcome = tree.body.freeNotes[0]
    expect(welcome.name).toBe('Welcome')
    expect(welcome.description).not.toBe('')

    const descriptions = Object.fromEntries(
      tree.body.sections.map((s: { name: string; description: string }) => [s.name, s.description]),
    )
    for (const description of Object.values(descriptions) as string[]) {
      // "A special section for keeping special (favored) notes." read as a
      // typo, and neither section has any special behaviour.
      expect(description).not.toMatch(/special/i)
      expect(description.length).toBeGreaterThan(0)
    }
  })
})
