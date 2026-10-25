import { readJson, removeKey, storageAvailable, writeJson } from '../utils/storage'

/**
 * Authentication boundary. The app only talks to `AuthService`, so a hosted provider (e.g. Supabase
 * via its official client, using the public anon key + row-level security) can replace the local
 * implementation without touching UI code.
 *
 * LocalDemoAuth is a DEMONSTRATION: accounts live in this browser's localStorage. Passwords are never
 * stored in plaintext (PBKDF2-SHA-256, 210k iterations, random salt), but anyone with access to the
 * browser profile can read or delete the records. It provides no real security, and route guards are
 * UI-level only: all data is in the bundle or the browser anyway.
 */

export interface Session {
  userId: string
  email: string | null
  name: string
  mode: 'local' | 'demo'
}

export type AuthErrorCode = 'invalid' | 'taken' | 'crypto' | 'storage'

export class AuthError extends Error {
  constructor(public code: AuthErrorCode) {
    super(code)
  }
}

export interface AuthService {
  getSession(): Session | null
  signIn(email: string, password: string): Promise<Session>
  signUp(email: string, password: string, name: string): Promise<Session>
  startDemo(name: string): Session
  signOut(): void
}

interface StoredUser {
  id: string
  email: string
  name: string
  salt: string
  hash: string
  iterations: number
  createdAt: number
}

const ITERATIONS = 210_000
const toHex = (buf: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))

async function derive(password: string, salt: Uint8Array, iterations: number) {
  if (!globalThis.crypto?.subtle) throw new AuthError('crypto')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
  return toHex(bits)
}

/** Constant-time string comparison for equal-length hex digests. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isUser(v: unknown): v is StoredUser {
  const u = v as StoredUser
  return !!u && typeof u.email === 'string' && typeof u.hash === 'string' && typeof u.salt === 'string' && typeof u.id === 'string'
}

function isSession(v: unknown): v is Session {
  const s = v as Session
  return !!s && typeof s.userId === 'string' && typeof s.name === 'string' && (s.mode === 'local' || s.mode === 'demo')
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase()

export class LocalDemoAuth implements AuthService {
  private users(): StoredUser[] {
    const raw = readJson('users')
    return Array.isArray(raw) ? raw.filter(isUser) : []
  }

  getSession() {
    const s = readJson('session')
    return isSession(s) ? s : null
  }

  private start(session: Session) {
    if (!writeJson('session', session) && session.mode === 'local') throw new AuthError('storage')
    return session
  }

  async signIn(email: string, password: string) {
    const user = this.users().find((u) => u.email === normalizeEmail(email))
    // Always derive, so timing doesn't reveal whether the account exists.
    const hash = await derive(password, user ? fromHex(user.salt) : new Uint8Array(16), user?.iterations ?? ITERATIONS)
    if (!user || !safeEqual(hash, user.hash)) throw new AuthError('invalid')
    return this.start({ userId: user.id, email: user.email, name: user.name || user.email, mode: 'local' })
  }

  async signUp(email: string, password: string, name: string) {
    if (!storageAvailable()) throw new AuthError('storage')
    const users = this.users()
    const norm = normalizeEmail(email)
    if (users.some((u) => u.email === norm)) throw new AuthError('taken')
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const user: StoredUser = {
      id: crypto.randomUUID?.() ?? toHex(crypto.getRandomValues(new Uint8Array(16))),
      email: norm,
      name: name.trim().slice(0, 40),
      salt: toHex(salt),
      hash: await derive(password, salt, ITERATIONS),
      iterations: ITERATIONS,
      createdAt: Date.now(),
    }
    writeJson('users', [...users, user])
    return this.start({ userId: user.id, email: user.email, name: user.name || user.email, mode: 'local' })
  }

  startDemo(name: string) {
    const session: Session = { userId: 'demo', email: null, name, mode: 'demo' }
    writeJson('session', session)
    return session
  }

  signOut() {
    removeKey('session')
  }
}

export const authService: AuthService = new LocalDemoAuth()

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const passwordOk = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p)
