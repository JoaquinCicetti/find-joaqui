import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkAdminKey, parseBody } from '../_lib'

// Validate the shared secret once so the UI can show a wrong-password error
// before it starts storing the key in sessionStorage.
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method not allowed' })
  }
  const { password } = parseBody(req)
  if (!checkAdminKey(typeof password === 'string' ? password : undefined)) {
    return res.status(401).json({ ok: false })
  }
  return res.status(200).json({ ok: true })
}
