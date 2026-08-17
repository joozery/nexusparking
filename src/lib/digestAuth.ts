import crypto from 'crypto'

// HTTP Digest Auth (RFC 7616) — Hikvision ISAPI only accepts Digest, not Basic.
// Shared by the live-view camera proxy (/api/camera) and server-side snapshot capture.

function parseDigestChallenge(header: string): Record<string, string> {
  const result: Record<string, string> = {}
  const re = /(\w+)=(?:"([^"]*)"|([^,]*))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(header))) result[m[1]] = m[2] ?? m[3]
  return result
}

function buildDigestHeader(opts: {
  user: string; pass: string; method: string; uri: string
  realm: string; nonce: string; qop?: string; opaque?: string; nc: number
}): string {
  const { user, pass, method, uri, realm, nonce, qop, opaque, nc } = opts
  const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex')
  const ha1 = md5(`${user}:${realm}:${pass}`)
  const ha2 = md5(`${method}:${uri}`)
  const ncHex = nc.toString(16).padStart(8, '0')
  const cnonce = crypto.randomBytes(8).toString('hex')
  const response = qop
    ? md5(`${ha1}:${nonce}:${ncHex}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`)
  const qopPart    = qop    ? `, qop=${qop}, nc=${ncHex}, cnonce="${cnonce}"` : ''
  const opaquePart = opaque ? `, opaque="${opaque}"` : ''
  return `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"${qopPart}${opaquePart}`
}

// Reuse the digest nonce across requests (per camera URL) so a repeat request doesn't need
// the unauthenticated 401-challenge round-trip every time — embedded Hikvision HTTP servers
// only handle a handful of concurrent connections and start returning 503 under polling load.
type DigestEntry = { realm: string; nonce: string; qop?: string; opaque?: string; nc: number }
const nonceCache = new Map<string, DigestEntry>()

async function digestRequest(camUrl: string, uri: string, user: string, pass: string, entry: DigestEntry) {
  entry.nc += 1
  const digest = buildDigestHeader({ user, pass, method: 'GET', uri, ...entry })
  return fetch(camUrl, { headers: { Authorization: digest }, cache: 'no-store' })
}

export async function fetchWithDigestAuth(camUrl: string, user: string, pass: string): Promise<Response> {
  const target = new URL(camUrl)
  const uri = target.pathname + target.search

  const cached = nonceCache.get(camUrl)
  if (cached) {
    const res = await digestRequest(camUrl, uri, user, pass, cached)
    if (res.status !== 401) return res
    nonceCache.delete(camUrl)
  }

  const probe = await fetch(camUrl, { cache: 'no-store' })
  if (probe.status !== 401) return probe

  const challenge = probe.headers.get('www-authenticate') ?? ''
  if (!challenge.toLowerCase().startsWith('digest')) {
    return fetch(camUrl, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') },
      cache: 'no-store',
    })
  }

  const params = parseDigestChallenge(challenge)
  const entry: DigestEntry = {
    realm: params.realm, nonce: params.nonce,
    qop: params.qop?.split(',')[0]?.trim(), opaque: params.opaque, nc: 0,
  }
  nonceCache.set(camUrl, entry)
  return digestRequest(camUrl, uri, user, pass, entry)
}
