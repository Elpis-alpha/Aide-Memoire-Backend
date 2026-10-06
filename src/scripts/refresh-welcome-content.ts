/**
 * One-off: brings accounts created before the 2026-10 welcome rewrite up to the
 * current welcome note and default-section copy.
 *
 * The welcome note is a per-user snapshot written at signup, so changing the
 * template only reaches new accounts. This rewrites the old snapshot for the
 * rest — but only where it is provably still the untouched original:
 *
 *   - a note is replaced only if it is the account's `welcome` note AND still
 *     contains a sentence that exists only in the 2022 text. Someone who has
 *     rewritten theirs keeps what they wrote.
 *   - a section description is replaced only if it still equals the old default
 *     verbatim.
 *
 * Dry run by default; nothing is written without `--apply`. It touches only the
 * database named in MONGODB_URL, and only documents matching those filters.
 *
 *   pnpm refresh:welcome            # report what would change
 *   pnpm refresh:welcome --apply    # do it
 */
import { env } from '../config/env'
import { connectToDatabase, disconnectFromDatabase } from '../db/connect'
import { welcomeNote } from '../mail/note-templates'
import { Note } from '../models/note.model'
import { Section } from '../models/section.model'

const LEGACY_NOTE_MARKER = 'tiny stars floating around'

const SECTION_COPY = [
  {
    name: 'Favorite',
    from: 'A special section for keeping special (favored) notes.',
    to: 'Notes you want close at hand.',
  },
  {
    name: 'Important',
    from: 'A special section for keeping notes of great significance or value.',
    to: 'Notes that matter most.',
  },
] as const

export type RefreshResult = { notes: number; sections: number; applied: boolean }

export const refreshWelcomeContent = async (
  frontendUrl: string,
  { apply }: { apply: boolean },
): Promise<RefreshResult> => {
  const noteFilter = {
    specialName: 'welcome',
    text: { $regex: LEGACY_NOTE_MARKER },
  }

  let notes = await Note.countDocuments(noteFilter)
  let sections = 0
  for (const copy of SECTION_COPY) {
    sections += await Section.countDocuments({
      name: copy.name,
      canDelete: false,
      description: copy.from,
    })
  }

  if (apply) {
    notes = (
      await Note.updateMany(noteFilter, {
        $set: {
          text: welcomeNote(frontendUrl),
          description: 'A two-minute tour. Edit it as you read.',
        },
      })
    ).modifiedCount

    sections = 0
    for (const copy of SECTION_COPY) {
      const result = await Section.updateMany(
        { name: copy.name, canDelete: false, description: copy.from },
        { $set: { description: copy.to } },
      )
      sections += result.modifiedCount
    }
  }

  return { notes, sections, applied: apply }
}

const main = async () => {
  const apply = process.argv.includes('--apply')

  await connectToDatabase()
  try {
    const result = await refreshWelcomeContent(env.FRONT_END_LOCATION, { apply })
    const verb = result.applied ? 'Updated' : 'Would update'
    process.stdout.write(
      `${verb} ${result.notes} welcome note(s) and ${result.sections} section description(s).\n`,
    )
    if (!result.applied) process.stdout.write('Dry run. Re-run with --apply to write.\n')
  } finally {
    await disconnectFromDatabase()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
