import { handler } from '../../lib/http.js'
import { endSession } from '../../lib/auth.js'

export default handler(['POST'], async (req, res) => {
  endSession(res)
  res.status(200).json({ ok: true })
})
