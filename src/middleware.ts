import { NextRequest, NextResponse } from 'next/server'

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const COOKIE  = 'np_session'

const PUBLIC = ['/login', '/api/auth']

async function verifyJWT(token: string): Promise<boolean> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const [header, payload, sig] = parts

    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    )

    // base64url → base64 → ArrayBuffer
    const pad   = (s: string) => s.padEnd(s.length + (4 - s.length % 4) % 4, '=')
    const sigB64 = pad(sig.replace(/-/g, '+').replace(/_/g, '/'))
    const sigBuf = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0))

    const valid = await crypto.subtle.verify('HMAC', key, sigBuf, enc.encode(`${header}.${payload}`))
    if (!valid) return false

    const payloadB64 = pad(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const data = JSON.parse(atob(payloadB64))
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return false

    return true
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow public paths
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Allow static assets
  if (pathname.startsWith('/_next') || pathname.includes('.')) return NextResponse.next()

  const token = req.cookies.get(COOKIE)?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  const valid = await verifyJWT(token)
  if (!valid) {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.set(COOKIE, '', { maxAge: 0, path: '/' })
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
