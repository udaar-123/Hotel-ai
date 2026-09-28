import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/modules/auth/service'
import { ForgotPasswordSchema } from '@/modules/auth/validation'
import { rateLimit } from '@/shared/utils/rate-limit'
import { ApiError } from '@/shared/errors'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ForgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    }

    const { email } = parsed.data
    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    // Rate limit: 5 requests per 30 minutes per IP
    const rl = await rateLimit(`ratelimit:forgot-password:${ip}`, 5, 1800)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const result = await AuthService.forgotPassword(email)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ success: false, message: err.message, code: err.code }, { status: err.statusCode })
    }
    console.error('[Forgot Password]', err)
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 })
  }
}
