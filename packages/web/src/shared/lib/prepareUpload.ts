import imageCompression from 'browser-image-compression'

// Mirror of the API's ATTACHMENT_MAX_SIZE / AVATAR_MAX_SIZE so we reject
// over-size files in the browser before paying for the round-trip and
// before hitting nginx's body limit.
export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

// Images get re-encoded; gif / svg are left alone (animation / vector loss).
const COMPRESSIBLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export type PrepareKind = 'attachment' | 'avatar'

interface PrepareOptions {
  kind?: PrepareKind
  // Target size after compression for images. The library treats this
  // as a soft cap and will keep dimensions/quality high if the source
  // is already small.
  imageTargetMB?: number
  imageMaxDimension?: number
}

const DEFAULTS: Required<Omit<PrepareOptions, 'kind'>> = {
  imageTargetMB: 1.5,
  imageMaxDimension: 1920,
}

const AVATAR_DEFAULTS: Required<Omit<PrepareOptions, 'kind'>> = {
  imageTargetMB: 0.5,
  imageMaxDimension: 512,
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export class FileTooLargeError extends Error {
  readonly file: File
  readonly limitBytes: number

  constructor(file: File, limitBytes: number) {
    super(
      `File "${file.name}" is ${formatMB(file.size)}, exceeds the ${formatMB(limitBytes)} limit. ` +
        (file.type.startsWith('video/')
          ? 'Try trimming or re-exporting the video at a lower resolution.'
          : 'Please pick a smaller file.'),
    )
    this.name = 'FileTooLargeError'
    this.file = file
    this.limitBytes = limitBytes
  }
}

/**
 * Compress images and validate size before upload. Throws
 * FileTooLargeError if a non-compressible file still exceeds the limit
 * after (or without) compression so callers can surface a friendly
 * toast.
 */
export async function prepareForUpload(
  file: File,
  opts: PrepareOptions = {},
): Promise<File> {
  const kind = opts.kind ?? 'attachment'
  const limit = kind === 'avatar' ? AVATAR_MAX_BYTES : ATTACHMENT_MAX_BYTES
  const defaults = kind === 'avatar' ? AVATAR_DEFAULTS : DEFAULTS

  if (COMPRESSIBLE_IMAGE_TYPES.has(file.type)) {
    const targetMB = opts.imageTargetMB ?? defaults.imageTargetMB
    const maxDim = opts.imageMaxDimension ?? defaults.imageMaxDimension
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: targetMB,
        maxWidthOrHeight: maxDim,
        useWebWorker: true,
        // Keep the original mime so the server-side ext check still
        // matches what the user picked.
        fileType: file.type,
        initialQuality: 0.82,
      })
      // Library returns a Blob in some paths; normalise to a File so
      // FormData carries the original filename.
      const out =
        compressed instanceof File
          ? compressed
          : new File([compressed], file.name, { type: file.type })
      if (out.size > limit) throw new FileTooLargeError(out, limit)
      return out
    } catch (err) {
      if (err instanceof FileTooLargeError) throw err
      // Compression failed for some odd input — fall through to the raw
      // file path so the user can still try the upload.
      console.warn('Image compression failed, uploading original:', err)
    }
  }

  if (file.size > limit) throw new FileTooLargeError(file, limit)
  return file
}
