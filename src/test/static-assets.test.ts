import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from './helpers'

describe('static assets', () => {
  // The welcome note embeds this image by absolute URL on the API host, and the
  // note is shown on the frontend's origin. helmet's default
  // `Cross-Origin-Resource-Policy: same-origin` makes the browser refuse it
  // (ERR_BLOCKED_BY_RESPONSE.NotSameOrigin), so the image must opt in.
  it('lets another origin embed the welcome note image', async () => {
    const response = await request(app).get('/img/welcome-note.jpg').expect(200)

    expect(response.headers['content-type']).toBe('image/jpeg')
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin')
  })

  it('keeps the strict default on everything else', async () => {
    const response = await request(app).get('/healthz').expect(200)

    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin')
  })
})
