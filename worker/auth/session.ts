import type { PlatformEnv } from '../config'

const SESSION_COOKIE = 'osm_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

export type SessionPayload = {
  userId: string
  githubId: number
  exp: number
}

function base64UrlEncode(value: string): string {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function base64UrlDecode(value: string): string {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(
    Math.ceil(value.length / 4) * 4,
    '=',
  )
  return atob(padded)
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return base64UrlEncode(binary)
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function getCookie(request: Request, name: string): string {
  const cookie = request.headers.get('Cookie') || ''
  for (const segment of cookie.split(';')) {
    const [rawKey, ...rawValue] = segment.trim().split('=')
    if (rawKey === name) return decodeURIComponent(rawValue.join('='))
  }
  return ''
}

function serializeCookie(
  request: Request,
  name: string,
  value: string,
  maxAge: number,
): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`
}

export async function createSessionCookie(
  request: Request,
  env: PlatformEnv,
  payload: Omit<SessionPayload, 'exp'>,
): Promise<string> {
  const secret = env.SUPABASE_SECRET_KEY?.trim()
  if (!secret) throw new Error('SUPABASE_SECRET_KEY is not configured')

  const session: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }
  const body = base64UrlEncode(JSON.stringify(session))
  const key = await importSigningKey(secret)
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(body),
  )

  return serializeCookie(
    request,
    SESSION_COOKIE,
    `${body}.${bytesToBase64Url(signature)}`,
    SESSION_TTL_SECONDS,
  )
}

export function clearSessionCookie(request: Request): string {
  return serializeCookie(request, SESSION_COOKIE, '', 0)
}

export async function readSession(
  request: Request,
  env: PlatformEnv,
): Promise<SessionPayload | null> {
  const secret = env.SUPABASE_SECRET_KEY?.trim()
  if (!secret) return null

  const raw = getCookie(request, SESSION_COOKIE)
  const [body, signature] = raw.split('.')
  if (!body || !signature) return null

  const key = await importSigningKey(secret)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    Uint8Array.from(base64UrlDecode(signature), (char) => char.charCodeAt(0)),
    new TextEncoder().encode(body),
  )
  if (!valid) return null

  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as SessionPayload
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.githubId !== 'number' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}
