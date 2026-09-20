import type { Types } from 'mongoose'
import { AppError } from '../../lib/errors'
import { escapeRegex } from '../../lib/escape-regex'
import { Tag, type TagDocument } from '../../models/tag.model'

export const createTag = async (name: string): Promise<TagDocument> => {
  const existing = await Tag.findOne({ name })
  // Tags are a shared vocabulary, so asking for one that exists returns it
  // rather than failing on the unique index.
  if (existing) return existing
  return Tag.create({ name })
}

/**
 * S2-03 — the old handler was `await req.body.forEach(async ...)`, which does
 * not await anything: it returned before the writes finished and sent its
 * response from inside the callback, so the count was wrong and a short input
 * could leave the request hanging. One bulk write replaces it.
 */
export const createTags = async (names: string[]): Promise<{ requested: number; saved: number }> => {
  const unique = [...new Set(names)]

  const result = await Tag.bulkWrite(
    unique.map(name => ({
      updateOne: { filter: { name }, update: { $setOnInsert: { name } }, upsert: true },
    })),
    { ordered: false },
  )

  return { requested: names.length, saved: result.upsertedCount }
}

export const getTag = async (id: Types.ObjectId): Promise<TagDocument> => {
  const tag = await Tag.findById(id)
  if (!tag) throw AppError.notFound()
  return tag
}

/**
 * Prefix matches first, then anything else containing the term — the same
 * ordering the old two-query version produced, with the input escaped.
 */
export const searchTags = async (prefix: string, limit: number): Promise<TagDocument[]> => {
  const safe = escapeRegex(prefix.toLowerCase())

  const starts = await Tag.find({ name: new RegExp(`^${safe}`) })
    .limit(limit)
    .sort({ name: 1 })

  if (starts.length >= limit) return starts

  const contains = await Tag.find({
    name: { $regex: new RegExp(safe), $not: new RegExp(`^${safe}`) },
  })
    .limit(limit - starts.length)
    .sort({ name: 1 })

  return [...starts, ...contains]
}
