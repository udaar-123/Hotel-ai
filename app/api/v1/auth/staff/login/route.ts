import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/modules/auth/service'
import { StaffLoginSchema } from '@/modules/auth/validation'
import { rateLimit } from '@/shared/utils/rate-limit'
import { ApiError } from '@/shared/errors'

const SESSION_COOKIE = 'session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = StaffLoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    }

    const { email, password } = parsed.data
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    // Rate limit: 10 login attempts per 15 minutes per IP
    const rl = await rateLimit(`ratelimit:staff-login:${ip}`, 10, 900)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const token = await AuthService.staffLogin(email, password)

    const response = NextResponse.json({ success: true, message: 'Logged in successfully.' })
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })
    return response
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ success: false, message: err.message, code: err.code }, { status: err.statusCode })
    }
    console.error('[Staff Login]', err)
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 })
  }
}
