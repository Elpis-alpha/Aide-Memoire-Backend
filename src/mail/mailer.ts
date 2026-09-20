import { createTransport } from 'nodemailer'
import { auth as googleAuth, gmail as gmailApi } from '@googleapis/gmail'
import { env } from '../config/env'
import { logger } from '../lib/logger'

/**
 * Gmail over HTTPS, per GMAIL-API-MIGRATION-NOTE.md. VPS hosts block outbound
 * SMTP (25/465/587), so nodemailer's SMTP transport hangs and times out in
 * production. nodemailer stays, but only to compose MIME — the bytes go out
 * through `gmail.users.messages.send` on 443.
 *
 * This also fixes S2-07: the old transporter minted one access token at module
 * load and never refreshed it, so mail died after roughly an hour of uptime.
 * googleapis refreshes internally.
 */

// The scoped @googleapis/gmail package rather than the umbrella `googleapis`,
// which bundles every Google API and was 115MB of the runtime image on its own.
const oauth2Client = env.mailConfigured
  ? new googleAuth.OAuth2(env.MAIL_CLIENT_ID, env.MAIL_CLIENT_SECRET)
  : null

// MAIL_REDIRECT_URI is deliberately absent — the refresh-token flow does not use it.
oauth2Client?.setCredentials({ refresh_token: env.MAIL_REFRESH_TOKEN })

const gmail = oauth2Client ? gmailApi({ version: 'v1', auth: oauth2Client }) : null

/** `buffer: true` makes sendMail return the composed message; it opens no socket. */
const mimeBuilder = createTransport({ streamTransport: true, buffer: true, newline: 'unix' })

const toBase64Url = (buffer: Buffer) =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export type MailResult = { ok: true; id: string | null } | { ok: false; reason: string }

/**
 * Never throws. Mail is best-effort: a failure is logged and reported to the
 * caller, but it must not fail the request that triggered it or the boot.
 */
export const sendMail = async (to: string, subject: string, html: string): Promise<MailResult> => {
  if (!gmail) {
    logger.warn({ to, subject }, 'mail not configured — skipping send')
    return { ok: false, reason: 'not_configured' }
  }

  try {
    const built = await mimeBuilder.sendMail({
      from: `"${env.EMAIL_NAME}" <${env.EMAIL_ADDRESS}>`,
      to,
      subject,
      html,
    })

    const raw = toBase64Url(built.message as Buffer)
    const sent = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })

    logger.info({ to, subject, id: sent.data.id }, 'mail sent')
    return { ok: true, id: sent.data.id ?? null }
  } catch (error) {
    logger.error({ err: error, to, subject }, 'mail send failed')
    return { ok: false, reason: 'send_failed' }
  }
}

/**
 * There is no SMTP socket to verify, so proving we can mint an access token is
 * the equivalent credentials probe. Called at boot for the log line only —
 * a failure must never stop `listen()`, or a mail outage plus
 * `restart: unless-stopped` becomes a crash loop.
 */
export const verifyMailer = async (): Promise<boolean> => {
  if (!oauth2Client) {
    logger.warn('mail credentials absent — outbound email is disabled')
    return false
  }

  try {
    const { token } = await oauth2Client.getAccessToken()
    if (!token) throw new Error('Could not obtain a Gmail access token')
    logger.info('mail credentials verified')
    return true
  } catch (error) {
    logger.error({ err: error }, 'mail credentials could not be verified — continuing without mail')
    return false
  }
}

/** Messages to the site owner get a footer identifying which host sent them. */
export const sendMailToOwner = (subject: string, html: string): Promise<MailResult> =>
  sendMail(
    env.EMAIL_ADDRESS,
    subject,
    `<div style="white-space: pre-wrap;">${html}\n\n<small> ~ From ${env.HOST}</small></div>`,
  )
