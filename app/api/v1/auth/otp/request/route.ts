import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/modules/auth/service'
import { RequestOtpSchema } from '@/modules/auth/validation'
import { rateLimit } from '@/shared/utils/rate-limit'
import { ApiError } from '@/shared/errors'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = RequestOtpSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    }

    const { identifier } = parsed.data
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    // Rate limit: 5 OTP requests per 10 minutes per IP
    const rl = await rateLimit(`ratelimit:otp-request:${ip}:${identifier}`, 5, 600)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'X-RateLimit-Reset': String(rl.resetAt) } }
      )
    }

    const result = await AuthService.requestOtp(identifier)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ success: false, message: err.message, code: err.code }, { status: err.statusCode })
    }
    console.error('[OTP Request]', err)
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 })
  }
}
