import { v2 as cloudinary } from 'cloudinary'
import { env } from '../../config/env'
import { AppError } from '../../lib/errors'
import { logger } from '../../lib/logger'

/**
 * Signed direct uploads: the backend issues a signature, the browser uploads
 * straight to Cloudinary, and only the resulting URL is stored.
 *
 * This is what lets `sharp` be deleted outright — no image bytes pass through
 * the API any more, so there is no resize step, no 20 MB multipart body, and
 * no native dependency in the Docker build (S1-05, S2-16).
 */
if (env.mediaConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

const assertConfigured = () => {
  if (!env.mediaConfigured) {
    throw AppError.serviceUnavailable('Media uploads are not configured on this server')
  }
}

export type UploadSignature = {
  timestamp: number
  signature: string
  apiKey: string
  cloudName: string
  folder: string
  uploadUrl: string
}

export const signUpload = (kind: 'avatar' | 'note-image', userId: string): UploadSignature => {
  assertConfigured()

  const timestamp = Math.floor(Date.now() / 1000)
  // Scoping the folder by user means a signature cannot be replayed to write
  // into somebody else's namespace.
  const folder = `${env.CLOUDINARY_FOLDER}/${kind}/${userId}`

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    env.CLOUDINARY_API_SECRET as string,
  )

  return {
    timestamp,
    signature,
    apiKey: env.CLOUDINARY_API_KEY as string,
    cloudName: env.CLOUDINARY_CLOUD_NAME as string,
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
  }
}

/** The uploaded asset must sit inside the caller's own folder. */
export const assertOwnedAsset = (publicId: string, kind: string, userId: string): void => {
  const expected = `${env.CLOUDINARY_FOLDER}/${kind}/${userId}/`
  if (!publicId.startsWith(expected)) {
    throw AppError.badRequest('That asset does not belong to this account')
  }
}

export const destroyAsset = async (publicId: string): Promise<void> => {
  if (!env.mediaConfigured) return
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    // A leftover remote asset is not worth failing the request over.
    logger.warn({ err: error, publicId }, 'could not delete cloudinary asset')
  }
}
