import { describe, expect, it } from 'vitest'
import { toExcerpt } from '../lib/excerpt'

describe('toExcerpt', () => {
  it('returns the readable start of a note, without markup', () => {
    expect(toExcerpt('<h2>Plan</h2><p>Ship the <strong>import</strong> first.</p>')).toBe(
      'Plan Ship the import first.',
    )
  })

  it('collapses the whitespace left between blocks', () => {
    expect(toExcerpt('<p>One</p>\n\n<p></p><p>  Two  </p>')).toBe('One Two')
  })

  it('decodes entities rather than showing them', () => {
    expect(toExcerpt('<p>Fish &amp; chips &lt;3 &quot;yes&quot;</p>')).toBe('Fish & chips <3 "yes"')
  })

  it('is empty for an empty note', () => {
    expect(toExcerpt('<p></p>')).toBe('')
    expect(toExcerpt('')).toBe('')
  })

  it('cuts long text at a word and marks it', () => {
    const out = toExcerpt(`<p>${'word '.repeat(100)}</p>`, 30)

    expect(out.length).toBeLessThanOrEqual(31)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toMatch(/wor…$/)
  })

  it('survives input that was cut off in the middle of a tag', () => {
    // The tree reads only the start of each body, so the last tag can be torn.
    expect(toExcerpt('<p>Hello <a href="https://exa')).toBe('Hello')
    expect(toExcerpt('<p>Hello <stro')).toBe('Hello')
  })

  it('never returns markup that could be injected into a page', () => {
    expect(toExcerpt('<p>a</p><script>alert(1)</script>')).not.toMatch(/[<>]/)
  })
})
