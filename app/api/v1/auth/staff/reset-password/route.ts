import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/modules/auth/service'
import { ResetPasswordSchema } from '@/modules/auth/validation'
import { ApiError } from '@/shared/errors'

const SESSION_COOKIE = 'session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ResetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    }

    const { token, password } = parsed.data
    const result = await AuthService.resetPassword(token, password)

    // Invalidate existing session cookie after password reset
    const response = NextResponse.json({ success: true, ...result })
    response.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
    return response
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ success: false, message: err.message, code: err.code }, { status: err.statusCode })
    }
    console.error('[Reset Password]', err)
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 })
  }
}
