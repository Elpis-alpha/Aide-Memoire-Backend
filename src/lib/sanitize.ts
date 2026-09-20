import sanitizeHtml from 'sanitize-html'

/**
 * S2-01 — note bodies are user-authored rich text rendered back as HTML, so
 * they were a stored-XSS vector. Sanitising on write keeps the database clean;
 * sanitising again on render means documents written before this change, or by
 * any future path that skips validation, still cannot execute script.
 */
const options: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'div', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['style', 'class'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
  },
  // `data:` stays allowed until Phase 3 migrates the inlined base64 images to
  // Cloudinary; dropping it now would blank existing note images.
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowedStyles: {
    '*': {
      color: [/^[^;{}()]*$/],
      'background-color': [/^[^;{}()]*$/],
      'font-size': [/^[\d.]+(px|rem|em|%)$/],
      'line-height': [/^[\d.]+(px|rem|em|%)?$/],
      'text-align': [/^(left|right|center|justify)$/],
      'font-family': [/^[^;{}()]*$/],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'text-decoration': [/^[a-z\s-]*$/],
      width: [/^[\d.]+(px|rem|em|%)$/],
      height: [/^[\d.]+(px|rem|em|%)$/],
    },
  },
  transformTags: {
    // Prevents reverse-tabnabbing on links that open a new tab.
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, ...(attribs.target ? { rel: 'noopener noreferrer' } : {}) },
    }),
  },
  disallowedTagsMode: 'discard',
}

export const sanitizeNoteHtml = (html: string): string => sanitizeHtml(html, options)

/** Plain-text fields: strip markup entirely rather than allow a subset. */
export const stripHtml = (value: string): string =>
  sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
