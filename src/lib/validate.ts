import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { ZodTypeAny, z } from 'zod'

type Schemas = {
  body?: ZodTypeAny
  params?: ZodTypeAny
  query?: ZodTypeAny
}

/**
 * Parses each part of the request against a zod schema, replacing the
 * hand-rolled `allowedUpdate` arrays that guarded mass assignment by
 * convention (S2-08). Unknown keys are stripped rather than trusted, so a
 * schema is the only way a field reaches a service.
 *
 * Express 5 makes `req.query` a getter, so results land on `req.valid` instead
 * of being written back over the originals.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.valid = {
        ...(schemas.body ? { body: schemas.body.parse(req.body) } : {}),
        ...(schemas.params ? { params: schemas.params.parse(req.params) } : {}),
        ...(schemas.query ? { query: schemas.query.parse(req.query) } : {}),
      }
      next()
    } catch (error) {
      // ZodError is normalised into a 400 by the error middleware.
      next(error)
    }
  }

/** Typed accessors — the matching `validate` call guarantees these are present. */
export const body = <T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> =>
  req.valid?.body as z.infer<T>

export const params = <T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> =>
  req.valid?.params as z.infer<T>

export const query = <T extends ZodTypeAny>(req: Request, _schema: T): z.infer<T> =>
  req.valid?.query as z.infer<T>
