import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { SessionPayload } from './types'

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'fallback-secret-key-at-least-32-chars-long'
)

// Passwords
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Tokens & OTPs (fast hashes, as they are high entropy or short-lived)
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// JWT Sessions
export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY)
}

export async function decryptSession(session: string | undefined = ''): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(session, SECRET_KEY, {
      algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
  } catch (_) {
    return null
  }
}
