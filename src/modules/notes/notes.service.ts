import type { FilterQuery, Types } from 'mongoose'
import { AppError } from '../../lib/errors'
import { sanitizeNoteHtml, stripHtml } from '../../lib/sanitize'
import { CURSOR_SORT, applyCursor, buildPage, type Page } from '../../lib/pagination'
import { Note, type INote, type NoteDocument } from '../../models/note.model'
import { Section } from '../../models/section.model'
import { Tag } from '../../models/tag.model'
import type { CreateNoteInput, UpdateNoteInput } from './notes.schemas'

/** Resolves the section/tag references back to `{_id, name}` on the wire (S2-15). */
const NAME_POPULATE = [
  { path: 'sections', select: 'name' },
  { path: 'tags', select: 'name' },
] as const

/** Fields a list view needs — never the full `text` body. */
const LIST_PROJECTION = 'name description sections tags isPublic owner createdAt updatedAt'

const listNotes = async (
  filter: FilterQuery<INote>,
  limit: number,
  cursor?: string,
): Promise<Page<NoteDocument>> => {
  const docs = await Note.find(applyCursor(filter, cursor))
    .select(LIST_PROJECTION)
    .sort(CURSOR_SORT)
    .limit(limit + 1)
    .populate(NAME_POPULATE as never)

  return buildPage(docs, limit)
}

/** Only sections the caller actually owns may be attached. */
const assertOwnedSections = async (owner: Types.ObjectId, ids: Types.ObjectId[]) => {
  if (ids.length === 0) return
  const count = await Section.countDocuments({ _id: { $in: ids }, owner })
  if (count !== new Set(ids.map(String)).size) {
    throw AppError.notFound('One of those sections does not exist')
  }
}

const assertTagsExist = async (ids: Types.ObjectId[]) => {
  if (ids.length === 0) return
  const count = await Tag.countDocuments({ _id: { $in: ids } })
  if (count !== new Set(ids.map(String)).size) {
    throw AppError.notFound('One of those tags does not exist')
  }
}

export const createNote = async (
  owner: Types.ObjectId,
  input: CreateNoteInput,
): Promise<NoteDocument> => {
  await assertOwnedSections(owner, input.sections)
  await assertTagsExist(input.tags)

  const note = await Note.create({
    owner,
    name: stripHtml(input.name),
    description: stripHtml(input.description),
    text: sanitizeNoteHtml(input.text),
    sections: input.sections,
    tags: input.tags,
  })

  return note.populate(NAME_POPULATE as never)
}

/**
 * Ownership is part of the query, not a check after the fetch, so there is no
 * window in which a note belonging to someone else has been loaded.
 */
export const getOwnedNote = async (
  owner: Types.ObjectId,
  id: Types.ObjectId,
): Promise<NoteDocument> => {
  const note = await Note.findOne({ _id: id, owner }).populate(NAME_POPULATE as never)
  if (!note) throw AppError.notFound()
  return note
}

export const getOwnedNoteBySpecialName = async (
  owner: Types.ObjectId,
  specialName: string,
): Promise<NoteDocument> => {
  const note = await Note.findOne({ owner, specialName }).populate(NAME_POPULATE as never)
  if (!note) throw AppError.notFound()
  return note
}

export const listOwnedNotes = (owner: Types.ObjectId, limit: number, cursor?: string) =>
  listNotes({ owner }, limit, cursor)

export const listOwnedNotesInSection = (
  owner: Types.ObjectId,
  sectionId: Types.ObjectId,
  limit: number,
  cursor?: string,
) => listNotes({ owner, sections: sectionId }, limit, cursor)

export const listOwnedNotesWithoutSection = (owner: Types.ObjectId, limit: number, cursor?: string) =>
  listNotes({ owner, sections: { $size: 0 } }, limit, cursor)

export const listOwnedNotesByTag = (
  owner: Types.ObjectId,
  tagId: Types.ObjectId,
  limit: number,
  cursor?: string,
) => listNotes({ owner, tags: tagId }, limit, cursor)

/**
 * S1-09 — search used `new RegExp(userInput)` on an unindexed field, which was
 * both a full collection scan and a ReDoS vector. The text index handles it.
 */
export const searchOwnedNotes = (
  owner: Types.ObjectId,
  term: string,
  limit: number,
  cursor?: string,
) => listNotes({ owner, $text: { $search: term } }, limit, cursor)

export const searchPublicNotes = (term: string, limit: number, cursor?: string) =>
  listNotes({ isPublic: true, $text: { $search: term } }, limit, cursor)

export const listPublicNotesByTag = (tagId: Types.ObjectId, limit: number, cursor?: string) =>
  listNotes({ isPublic: true, tags: tagId }, limit, cursor)

export const getPublicNote = async (id: Types.ObjectId): Promise<NoteDocument> => {
  const note = await Note.findOne({ _id: id, isPublic: true }).populate(NAME_POPULATE as never)
  if (!note) throw AppError.notFound()
  return note
}

/**
 * S1-03 — the section being public was treated as sufficient, so every private
 * note filed under a shared section was served to anonymous callers. The note's
 * own `isPublic` is now required as well, on both of these paths.
 */
export const listPublicNotesInSection = async (
  sectionId: Types.ObjectId,
  limit: number,
  cursor?: string,
): Promise<Page<NoteDocument>> => {
  const section = await Section.findOne({ _id: sectionId, isPublic: true })
  if (!section) throw AppError.notFound()

  return listNotes({ sections: sectionId, isPublic: true }, limit, cursor)
}

export const getPublicNoteInSection = async (
  sectionId: Types.ObjectId,
  noteId: Types.ObjectId,
) => {
  const section = await Section.findOne({ _id: sectionId, isPublic: true })
  if (!section) throw AppError.notFound()

  const note = await Note.findOne({
    _id: noteId,
    sections: sectionId,
    isPublic: true,
  }).populate(NAME_POPULATE as never)

  if (!note) throw AppError.notFound()

  return { section, note }
}

export const updateNote = async (
  owner: Types.ObjectId,
  id: Types.ObjectId,
  input: UpdateNoteInput,
): Promise<NoteDocument> => {
  const note = await Note.findOne({ _id: id, owner })
  // The old handler dereferenced the note before its null check (S2-04).
  if (!note) throw AppError.notFound()

  if (input.name !== undefined) note.name = stripHtml(input.name)
  if (input.description !== undefined) note.description = stripHtml(input.description)
  if (input.text !== undefined) note.text = sanitizeNoteHtml(input.text)

  await note.save()
  return note.populate(NAME_POPULATE as never)
}

export const setNoteVisibility = async (
  owner: Types.ObjectId,
  id: Types.ObjectId,
): Promise<boolean> => {
  const note = await Note.findOne({ _id: id, owner })
  if (!note) throw AppError.notFound()

  note.isPublic = !note.isPublic
  await note.save()
  return note.isPublic
}

export const deleteNote = async (owner: Types.ObjectId, id: Types.ObjectId): Promise<void> => {
  const result = await Note.findOneAndDelete({ _id: id, owner, canDelete: true })
  if (!result) throw AppError.notFound()
}

/**
 * `$addToSet` / `$pull` in a single update. The old code read the document,
 * pushed, then de-duplicated in JavaScript on every call — which is also why
 * duplicates kept appearing under concurrent edits.
 */
export const attachRelation = async (
  owner: Types.ObjectId,
  noteId: Types.ObjectId,
  field: 'sections' | 'tags',
  relationId: Types.ObjectId,
): Promise<NoteDocument> => {
  if (field === 'sections') await assertOwnedSections(owner, [relationId])
  else await assertTagsExist([relationId])

  const note = await Note.findOneAndUpdate(
    { _id: noteId, owner },
    { $addToSet: { [field]: relationId } },
    { new: true },
  ).populate(NAME_POPULATE as never)

  if (!note) throw AppError.notFound()
  return note
}

export const detachRelation = async (
  owner: Types.ObjectId,
  noteId: Types.ObjectId,
  field: 'sections' | 'tags',
  relationId: Types.ObjectId,
): Promise<NoteDocument> => {
  const note = await Note.findOneAndUpdate(
    { _id: noteId, owner },
    { $pull: { [field]: relationId } },
    { new: true },
  ).populate(NAME_POPULATE as never)

  if (!note) throw AppError.notFound()
  return note
}

/**
 * S2-23 — the sidebar previously fetched the section list, then issued one
 * request per section for its notes. One aggregation replaces the whole set.
 */
export const getTree = async (owner: Types.ObjectId) => {
  const sections = await Section.aggregate([
    { $match: { owner } },
    { $sort: { name: 1 } },
    {
      $lookup: {
        from: Note.collection.name,
        let: { sectionId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$owner', owner] }, { $in: ['$$sectionId', '$sections'] }] } } },
          { $sort: { updatedAt: -1 } },
          { $project: { name: 1, description: 1, isPublic: 1, updatedAt: 1 } },
        ],
        as: 'notes',
      },
    },
  ])

  const freeNotes = await Note.find({ owner, sections: { $size: 0 } })
    .select('name description isPublic updatedAt')
    .sort({ updatedAt: -1 })

  return { sections, freeNotes }
}
