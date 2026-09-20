import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildOpenApiDocument } from './document'

/** Writes the committed spec the frontend generates its types from. */
const target = path.join(__dirname, '../../openapi.json')
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`)
console.log(`wrote ${target}`)
