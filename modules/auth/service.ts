import { AuthRepository } from './repository'
import {
  hashPassword,
  comparePassword,
  generateOtp,
  generateRandomToken,
  hashToken,
  encryptSession,
} from './utils'
import { ApiError } from '@/shared/errors'
import { UserRole } from './types'
import resend from '@/lib/resend'

const OTP_EXPIRY_MINUTES = 10
const RESET_TOKEN_EXPIRY_HOURS = 1

export const AuthService = {
  // ── Customer OTP ────────────────────────────────────────────────────────────

  async requestOtp(identifier: string) {
    // Find or create the customer user record
    let user = await AuthRepository.findUserByIdentifier(identifier)
    if (!user) {
      user = await AuthRepository.createCustomer(identifier)
    }

    const otp = generateOtp()
    const otpHash = hashToken(otp)       // SHA-256 hash — OTP is never stored in plaintext
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    // Always log OTP in dev so you can use it even if email is blocked
    console.log(`\n🔑 [DEV OTP] ${identifier} → ${otp}\n`)

    await AuthRepository.upsertOtpVerification(user.id, identifier, otpHash, expiresAt)

    // Send OTP directly via Resend
    const isEmail = identifier.includes('@')
    if (isEmail) {
      const { data, error } = await resend.emails.send({
        from: 'Hotel <onboarding@resend.dev>',
        to: identifier,
        subject: 'Your OTP Code',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;border-radius:12px;">
            <h2 style="color:#6366f1;margin:0 0 8px;">Hotel Management</h2>
            <p style="color:#94a3b8;margin:0 0 24px;">Your one-time password is:</p>
            <div style="background:#1e293b;border-radius:8px;padding:24px;text-align:center;letter-spacing:0.25em;">
              <span style="font-size:40px;font-weight:700;color:#fff;">${otp}</span>
            </div>
            <p style="color:#64748b;font-size:13px;margin:20px 0 0;">This code expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.</p>
          </div>
        `,
      })
      if (error) {
        console.error('[OTP Email Error]', error)
      } else {
        console.log(`[OTP Email Sent] id=${data?.id}`)
      }
    } else {
      // SMS placeholder — wire Twilio here when needed
      console.log(`[OTP] SMS for ${identifier}: ${otp}`)
    }

    return { message: 'OTP sent successfully.' }
  },

  async verifyOtp(identifier: string, code: string): Promise<string> {
    const user = await AuthRepository.findUserByIdentifier(identifier)
    if (!user) {
      throw new ApiError(400, 'OTP not found or expired. Please request a new one.', 'OTP_NOT_FOUND')
    }

    const record = await AuthRepository.getOtpVerificationByUserId(user.id)

    if (!record) {
      throw new ApiError(400, 'OTP not found or expired. Please request a new one.', 'OTP_NOT_FOUND')
    }

    if (new Date() > record.expiresAt) {
      await AuthRepository.deleteOtpVerification(record.id)
      throw new ApiError(400, 'OTP has expired. Please request a new one.', 'OTP_EXPIRED')
    }

    const inputHash = hashToken(code)
    if (inputHash !== record.code) {
      throw new ApiError(400, 'Invalid OTP. Please check the code and try again.', 'OTP_INVALID')
    }

    // OTP is valid — consume it
    await AuthRepository.deleteOtpVerification(record.id)

    const role = (user.role as UserRole) ?? UserRole.CUSTOMER
    const sessionToken = await encryptSession({ userId: user.id, role })
    return sessionToken
  },

  // ── Staff Password Auth ──────────────────────────────────────────────────────

  async staffLogin(email: string, password: string): Promise<string> {
    const user = await AuthRepository.findUserByIdentifier(email)

    // Generic error — do not reveal whether the account exists
    const genericError = new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS')

    if (!user || !user.passwordHash || !user.role) throw genericError
    
    if (user.staff_profile?.deactivatedAt) {
      throw new ApiError(403, 'Account is deactivated.', 'ACCOUNT_DEACTIVATED')
    }

    const validPassword = await comparePassword(password, user.passwordHash)
    if (!validPassword) throw genericError

    const mustChangePassword = user.staff_profile?.mustChangePassword ?? false;
    const sessionToken = await encryptSession({ 
      userId: user.id, 
      role: user.role as UserRole,
      mustChangePassword
    })
    return sessionToken
  },

  async forgotPassword(email: string) {
    const user = await AuthRepository.findUserByIdentifier(email)

    // Always return success — do not reveal if email exists
    if (!user) {
      return { message: 'If that account exists, a reset link has been sent.' }
    }

    const rawToken = generateRandomToken()
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

    await AuthRepository.createPasswordResetToken(user.id, tokenHash, expiresAt)

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/staff/reset-password?token=${rawToken}`
    const body = `<p>Click the link below to reset your password. This link is valid for ${RESET_TOKEN_EXPIRY_HOURS} hour(s).</p>
    <a href="${resetUrl}">Reset Password</a>
    <p>If you did not request this, ignore this email.</p>`

    // Send reset email directly via Resend
    const { error } = await resend.emails.send({
      from: 'Hotel <onboarding@resend.dev>',
      to: email,
      subject: 'Password Reset Request',
      html: body,
    })
    if (error) console.error('[Reset Email]', error)

    return { message: 'If that account exists, a reset link has been sent.' }
  },

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = hashToken(rawToken)
    const record = await AuthRepository.getPasswordResetToken(tokenHash)

    if (!record) {
      throw new ApiError(400, 'Invalid or expired reset token.', 'RESET_TOKEN_INVALID')
    }

    if (new Date() > record.expiresAt) {
      await AuthRepository.deletePasswordResetToken(record.id)
      throw new ApiError(400, 'Reset token has expired. Please request a new one.', 'RESET_TOKEN_EXPIRED')
    }

    const passwordHash = await hashPassword(newPassword)

    // Update password and delete the used token atomically-ish
    await AuthRepository.updateUserPassword(record.userId, passwordHash)
    await AuthRepository.deletePasswordResetToken(record.id)

    return { message: 'Password reset successfully. Please log in.' }
  },

  async changePassword(userId: string, newPassword: string): Promise<string> {
    const passwordHash = await hashPassword(newPassword)
    await AuthRepository.updateUserPassword(userId, passwordHash)

    const user = await AuthRepository.findUserById(userId)
    if (!user) throw new ApiError(404, 'User not found')

    if (user.staff_profile) {
      const { prisma } = require('@/lib/prisma')
      // Clear the mustChangePassword flag
      await prisma.staff_profiles.update({
        where: { userId },
        data: { mustChangePassword: false }
      })
    }

    const sessionToken = await encryptSession({ 
      userId: user.id, 
      role: user.role as UserRole,
      mustChangePassword: false
    })
    return sessionToken
  }
}
