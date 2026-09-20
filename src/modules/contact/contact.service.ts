import { AppError } from '../../lib/errors'
import { stripHtml } from '../../lib/sanitize'
import { sendMailToOwner } from '../../mail/mailer'
import type { ContactInput } from './contact.schemas'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const deliverContactMessage = async (input: ContactInput, from?: string): Promise<void> => {
  // Markup is stripped and then escaped, so the message arrives as text no
  // matter what was submitted.
  const subject = stripHtml(input.title)
  const bodyText = stripHtml(input.content)

  const html = `${from ? `From: ${escapeHtml(from)}\n\n` : ''}${escapeHtml(bodyText)}`

  const result = await sendMailToOwner(subject, html)
  if (!result.ok) throw AppError.serviceUnavailable('That message could not be sent right now')
}
