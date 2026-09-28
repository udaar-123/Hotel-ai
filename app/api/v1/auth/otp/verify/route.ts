import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/modules/auth/service'
import { VerifyOtpSchema } from '@/modules/auth/validation'
import { rateLimit } from '@/shared/utils/rate-limit'
import { ApiError } from '@/shared/errors'

const SESSION_COOKIE = 'session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = VerifyOtpSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    }

    const { identifier, code } = parsed.data
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    // Rate limit: 10 verify attempts per 10 minutes per IP
    const rl = await rateLimit(`ratelimit:otp-verify:${ip}:${identifier}`, 10, 600)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const token = await AuthService.verifyOtp(identifier, code)

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
    console.error('[OTP Verify]', err)
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 })
  }
}
