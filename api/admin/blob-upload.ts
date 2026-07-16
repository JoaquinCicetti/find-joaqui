import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { checkAdminKey, parseBody } from '../_lib'

// Token issuer for browser → Blob direct uploads. The browser's upload() calls
// here to get a short-lived token, so BLOB_READ_WRITE_TOKEN never ships to the
// client. Auth travels in clientPayload (the admin key) since upload() can't
// attach custom headers to this internal request.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method not allowed' })
  }
  try {
    const result = await handleUpload({
      body: parseBody(req) as unknown as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!checkAdminKey(clientPayload ?? undefined)) {
          throw new Error('unauthorized')
        }
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          addRandomSuffix: false,
          maximumSizeInBytes: 60 * 1024 * 1024,
        }
      },
      // Metadata is persisted by the client via /api/admin/media once every
      // blob resolves, so there's nothing to do here.
      onUploadCompleted: async () => {},
    })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message })
  }
}
