import type { RequestHandler } from 'express'
import { body, params, query } from '../../lib/validate'
import { currentUser } from '../../middleware/auth'
import {
  createSectionSchema,
  sectionIdParamsSchema,
  sectionListQuerySchema,
  updateSectionSchema,
} from './sections.schemas'
import * as sections from './sections.service'
import { listOwnedNotesInSection } from '../notes/notes.service'

export const create: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  res.status(201).json(await sections.createSection(user._id, body(req, createSectionSchema)))
}

export const list: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  res.json(await sections.listOwnedSections(user._id))
}

export const getOne: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, sectionIdParamsSchema)
  res.json(await sections.getOwnedSection(user._id, id))
}

export const listNotes: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, sectionIdParamsSchema)
  const { limit, cursor } = query(req, sectionListQuerySchema)

  // Proves the section is the caller's before listing anything under it.
  await sections.getOwnedSection(user._id, id)
  res.json(await listOwnedNotesInSection(user._id, id, limit, cursor))
}

export const update: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, sectionIdParamsSchema)
  res.json(await sections.updateSection(user._id, id, body(req, updateSectionSchema)))
}

export const toggleOpen: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, sectionIdParamsSchema)
  res.json({ open: await sections.toggleSectionFlag(user._id, id, 'open') })
}

export const togglePublic: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, sectionIdParamsSchema)
  res.json({ isPublic: await sections.toggleSectionFlag(user._id, id, 'isPublic') })
}

export const remove: RequestHandler = async (req, res) => {
  const user = currentUser(req)
  const { id } = params(req, sectionIdParamsSchema)
  await sections.deleteSection(user._id, id)
  res.json({ message: 'section deleted' })
}

export const getPublicOne: RequestHandler = async (req, res) => {
  const { id } = params(req, sectionIdParamsSchema)
  const section = await sections.getPublicSection(id)
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  res.json(section)
}
