import mongoose, { type Types } from 'mongoose'
import { AppError } from '../../lib/errors'
import { stripHtml } from '../../lib/sanitize'
import { Section, type SectionDocument } from '../../models/section.model'
import { Note } from '../../models/note.model'
import type { CreateSectionInput, UpdateSectionInput } from './sections.schemas'

export const createSection = (owner: Types.ObjectId, input: CreateSectionInput) =>
  Section.create({
    owner,
    name: stripHtml(input.name),
    description: stripHtml(input.description),
  })

export const listOwnedSections = (owner: Types.ObjectId) =>
  Section.find({ owner }).sort({ name: 1 })

export const getOwnedSection = async (
  owner: Types.ObjectId,
  id: Types.ObjectId,
): Promise<SectionDocument> => {
  const section = await Section.findOne({ _id: id, owner })
  if (!section) throw AppError.notFound()
  return section
}

export const getPublicSection = async (id: Types.ObjectId): Promise<SectionDocument> => {
  const section = await Section.findOne({ _id: id, isPublic: true })
  if (!section) throw AppError.notFound()
  return section
}

export const updateSection = async (
  owner: Types.ObjectId,
  id: Types.ObjectId,
  input: UpdateSectionInput,
): Promise<SectionDocument> => {
  const section = await Section.findOne({ _id: id, owner })
  if (!section) throw AppError.notFound()

  if (input.name !== undefined) section.name = stripHtml(input.name)
  if (input.description !== undefined) section.description = stripHtml(input.description)
  if (input.isPublic !== undefined) section.isPublic = input.isPublic

  // Renaming is now just this. Under the old denormalized copies it also had
  // to rewrite the embedded name in every note, which it never did (S2-15).
  await section.save()
  return section
}

export const toggleSectionFlag = async (
  owner: Types.ObjectId,
  id: Types.ObjectId,
  field: 'open' | 'isPublic',
): Promise<boolean> => {
  const section = await Section.findOne({ _id: id, owner })
  if (!section) throw AppError.notFound()

  section[field] = !section[field]
  await section.save()
  return section[field]
}

/**
 * S2-15 — the old handler deleted the section and left a dangling `{_id, name}`
 * copy inside every note that referenced it. The reference is now pulled from
 * the notes in the same transaction.
 */
export const deleteSection = async (owner: Types.ObjectId, id: Types.ObjectId): Promise<void> => {
  const session = await mongoose.startSession()

  try {
    await session.withTransaction(async () => {
      const section = await Section.findOneAndDelete({ _id: id, owner, canDelete: true }, { session })
      if (!section) throw AppError.notFound()

      await Note.updateMany({ owner, sections: id }, { $pull: { sections: id } }, { session })
    })
  } finally {
    await session.endSession()
  }
}
