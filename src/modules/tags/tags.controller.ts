import type { RequestHandler } from 'express'
import { body, params, query } from '../../lib/validate'
import { createManyTagsSchema, createTagSchema, tagIdParamsSchema, tagSearchQuerySchema } from './tags.schemas'
import * as tags from './tags.service'

export const create: RequestHandler = async (req, res) => {
  const { name } = body(req, createTagSchema)
  res.status(201).json(await tags.createTag(name))
}

export const createMany: RequestHandler = async (req, res) => {
  const { names } = body(req, createManyTagsSchema)
  const { requested, saved } = await tags.createTags(names)
  res.status(201).json({
    message: `${requested} sent, ${saved} saved, ${requested - saved} already existed`,
    requested,
    saved,
  })
}

export const getOne: RequestHandler = async (req, res) => {
  const { id } = params(req, tagIdParamsSchema)
  res.json(await tags.getTag(id))
}

export const search: RequestHandler = async (req, res) => {
  const { prefix, limit } = query(req, tagSearchQuerySchema)
  res.json(await tags.searchTags(prefix, limit))
}
