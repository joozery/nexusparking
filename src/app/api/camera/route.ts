import { NextRequest } from 'next/server'
import { fetchWithDigestAuth } from '@/lib/digestAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const camUrl  = searchParams.get('url')
  const user    = searchParams.get('u') ?? ''
  const pass    = searchParams.get('p') ?? ''

  if (!camUrl) return new Response('Missing url param', { status: 400 })

  const upstream = (user || pass)
    ? await fetchWithDigestAuth(camUrl, user, pass)
    : await fetch(camUrl, { cache: 'no-store' })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type':  upstream.headers.get('Content-Type') ?? 'multipart/x-mixed-replace',
      'Cache-Control': 'no-cache, no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
