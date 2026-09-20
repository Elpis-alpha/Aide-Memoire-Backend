/**
 * S1-09 — user input reached `new RegExp()` unescaped, so a term like `(a+)+$`
 * was both a syntax hazard and a ReDoS vector. Note search now uses the text
 * index; tag prefix lookup still needs a regex, so it escapes first.
 */
export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
