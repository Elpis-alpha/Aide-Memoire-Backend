import type { RequestHandler } from 'express'
import { body, params, query } from '../../lib/validate'
import { currentUser } from '../../middleware/auth'
import { sanitizeNoteHtml } from '../../lib/sanitize'
import type { NoteDocument } from '../../models/note.model'
import type { Page } from '../../lib/pagination'
import {
  addRelationSchema,
  createNoteSchema,
  listQuerySchema,
  noteIdParamsSchema,
  noteRelationParamsSchema,
  searchQuerySchema,
  sectionNoteParamsSchema,
  specialNameParamsSchema,
  tagIdParamsSchema,
  updateNoteSchema,
} from './notes.schemas'
import * as notes from './notes.service'

/**
 * S2-01 — the second half of the sanitize-on-write-and-render pair. Documents
 * stored before sanitising existed still pass through this on the way out.
 */
const present = (note: NoteDocument) => {
  const json = note.toJSON() as Record<string, unknown>
  if (typeof json.text === 'string') json.text = sanitizeNoteHtml(json.text)
  return json
}

const presentPage = (page: Page<NoteDocument>) => ({
  items: page.items.map(present),
  nextCursor: page.nextCursor,
})

export const create: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const note = await notes.createNote(user._id, body(req, createNoteSchema))
  res.status(201).json(present(note))
}

export const list: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { limit, cursor } = query(req, listQuerySchema)
  res.json(presentPage(await notes.listOwnedNotes(user._id, limit, cursor)))
}

export const listFree: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { limit, cursor } = query(req, listQuerySchema)
  res.json(presentPage(await notes.listOwnedNotesWithoutSection(user._id, limit, cursor)))
}

export const search: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { q, limit, cursor } = query(req, searchQuerySchema)
  res.json(presentPage(await notes.searchOwnedNotes(user._id, q, limit, cursor)))
}

export const listByTag: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { tagId } = params(req, tagIdParamsSchema)
  const { limit, cursor } = query(req, listQuerySchema)
  res.json(presentPage(await notes.listOwnedNotesByTag(user._id, tagId, limit, cursor)))
}

export const getOne: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, noteIdParamsSchema)
  res.json(present(await notes.getOwnedNote(user._id, id)))
}

export const getBySpecialName: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { name } = params(req, specialNameParamsSchema)
  res.json(present(await notes.getOwnedNoteBySpecialName(user._id, name)))
}

export const update: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, noteIdParamsSchema)
  res.json(present(await notes.updateNote(user._id, id, body(req, updateNoteSchema))))
}

export const toggleVisibility: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, noteIdParamsSchema)
  res.json({ isPublic: await notes.setNoteVisibility(user._id, id) })
}

export const remove: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, noteIdParamsSchema)
  await notes.deleteNote(user._id, id)
  res.json({ message: 'note deleted' })
}

export const addSection: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, noteIdParamsSchema)
  const { id: sectionId } = body(req, addRelationSchema)
  const note = await notes.attachRelation(user._id, id, 'sections', sectionId)
  res.json(note.sections)
}

export const removeSection: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id, relationId } = params(req, noteRelationParamsSchema)
  const note = await notes.detachRelation(user._id, id, 'sections', relationId)
  res.json(note.sections)
}

export const addTag: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, noteIdParamsSchema)
  const { id: tagId } = body(req, addRelationSchema)
  const note = await notes.attachRelation(user._id, id, 'tags', tagId)
  res.json(note.tags)
}

export const removeTag: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id, relationId } = params(req, noteRelationParamsSchema)
  const note = await notes.detachRelation(user._id, id, 'tags', relationId)
  res.json(note.tags)
}

export const tree: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  res.json(await notes.getTree(user._id))
}

// ---- Public surface -------------------------------------------------------
// Cacheable at the edge; these are the SEO pages.

const publicCache = (res: Parameters<RequestHandler>[1]) => {
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
}

export const getPublicOne: RequestHandler = async (req, res) => {
  const { id } = params(req, noteIdParamsSchema)
  const note = await notes.getPublicNote(id)
  publicCache(res)
  res.json(present(note))
}

export const searchPublic: RequestHandler = async (req, res) => {
  const { q, limit, cursor } = query(req, searchQuerySchema)
  publicCache(res)
  res.json(presentPage(await notes.searchPublicNotes(q, limit, cursor)))
}

export const listPublicByTag: RequestHandler = async (req, res) => {
  const { tagId } = params(req, tagIdParamsSchema)
  const { limit, cursor } = query(req, listQuerySchema)
  publicCache(res)
  res.json(presentPage(await notes.listPublicNotesByTag(tagId, limit, cursor)))
}

export const listPublicInSection: RequestHandler = async (req, res) => {
  const { id } = params(req, noteIdParamsSchema)
  const { limit, cursor } = query(req, listQuerySchema)
  publicCache(res)
  res.json(presentPage(await notes.listPublicNotesInSection(id, limit, cursor)))
}

export const getPublicInSection: RequestHandler = async (req, res) => {
  const { sectionId, noteId } = params(req, sectionNoteParamsSchema)
  const { section, note } = await notes.getPublicNoteInSection(sectionId, noteId)
  publicCache(res)
  res.json({ section, note: present(note) })
}
