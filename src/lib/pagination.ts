import { z } from 'zod'
import type { FilterQuery } from 'mongoose'
import { Types } from 'mongoose'

/**
 * S2-17 — list endpoints returned unbounded result sets, so an account with
 * thousands of notes downloaded all of them on every page load.
 *
 * Cursor rather than skip/limit: skip degrades linearly on deep pages and
 * shifts results when a document is inserted mid-scroll. The cursor encodes
 * the sort key (`updatedAt`) plus `_id` to break ties.
 */

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 100

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursor: z.string().max(200).optional(),
})

export type PaginationInput = z.infer<typeof paginationSchema>

type Cursor = { updatedAt: Date; id: Types.ObjectId }

export const encodeCursor = (doc: { updatedAt: Date; _id: Types.ObjectId }): string =>
  Buffer.from(`${doc.updatedAt.toISOString()}|${doc._id.toString()}`).toString('base64url')

export const decodeCursor = (raw: string): Cursor | null => {
  try {
    const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|')
    if (!iso || !id || !Types.ObjectId.isValid(id)) return null
    const updatedAt = new Date(iso)
    if (Number.isNaN(updatedAt.getTime())) return null
    return { updatedAt, id: new Types.ObjectId(id) }
  } catch {
    return null
  }
}

/** Adds the "everything strictly after the cursor" clause to a filter. */
export const applyCursor = <T>(filter: FilterQuery<T>, raw?: string): FilterQuery<T> => {
  if (!raw) return filter
  const cursor = decodeCursor(raw)
  // A malformed cursor reads as "start from the beginning" rather than an error.
  if (!cursor) return filter

  return {
    ...filter,
    $or: [
      { updatedAt: { $lt: cursor.updatedAt } },
      { updatedAt: cursor.updatedAt, _id: { $lt: cursor.id } },
    ],
  } as FilterQuery<T>
}

export const CURSOR_SORT = { updatedAt: -1, _id: -1 } as const

export type Page<T> = { items: T[]; nextCursor: string | null }

/**
 * Call with one more document than requested: the extra one proves there is a
 * further page without a second count query.
 */
export const buildPage = <T extends { updatedAt: Date; _id: Types.ObjectId }>(
  docs: T[],
  limit: number,
): Page<T> => {
  const hasMore = docs.length > limit
  const items = hasMore ? docs.slice(0, limit) : docs
  const last = items.at(-1)
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  }
}
