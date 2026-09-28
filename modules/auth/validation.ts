import { z } from 'zod'

export const StaffLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const RequestOtpSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
})

export const VerifyOtpSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  code: z.string().length(6, 'OTP must be 6 digits'),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
