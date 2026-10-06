import { stripHtml } from './sanitize'

/**
 * How much of a note body the list queries read. Enough for a readable excerpt
 * after markup is stripped, small enough that a sidebar of hundreds of notes
 * does not carry hundreds of whole documents.
 */
export const EXCERPT_SOURCE_CHARS = 600

const ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

/**
 * The readable start of a note, as plain text, so lists can tell notes apart
 * when their titles do not (every new note is "Untitled note").
 *
 * The input may be cut mid-tag, because the list queries read only the first
 * `EXCERPT_SOURCE_CHARS` of a body; a torn trailing tag is dropped.
 */
export const toExcerpt = (html: string, max = 140): string => {
  const withoutTornTag = html.replace(/<[^>]*$/, '')
  // Blocks become a space, so "<h2>Plan</h2><p>Ship" reads "Plan Ship".
  const spaced = withoutTornTag.replace(/<\/(?:p|h[1-6]|li|blockquote|div|pre|tr)>|<br\s*\/?>/gi, ' ')

  const text = stripHtml(spaced)
    .replace(/&(?:lt|gt|quot|#39|nbsp);/g, entity => ENTITIES[entity] ?? entity)
    // Last, so "&amp;lt;" is not decoded twice.
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= max) return text

  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const atWord = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${atWord.replace(/[\s.,;:!?-]+$/, '')}…`
}
