'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ResetPasswordSchema } from '@/modules/auth/validation'

import { Suspense } from 'react'

type ResetPasswordForm = z.infer<typeof ResetPasswordSchema>

function ResetPasswordFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordForm>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { token },
  })

  async function onSubmit(data: ResetPasswordForm) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v1/auth/staff/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      router.push('/auth/staff/login?reset=success')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="bg-slate-800/60 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 text-center max-w-sm">
        <p className="text-red-400 font-medium mb-4">Invalid or missing reset token.</p>
        <Link href="/auth/staff/forgot-password" className="text-indigo-400 hover:text-indigo-300 text-sm">Request a new reset link →</Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-500/30">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">New Password</h1>
        <p className="text-slate-400 text-sm mt-1">Hotel Management — Staff Portal</p>
      </div>

      <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-1">Set a new password</h2>
        <p className="text-slate-400 text-sm mb-6">Choose a strong password with at least 8 characters.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <input type="hidden" {...register('token')} />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
            <input
              {...register('password')}
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/70 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>}
          </div>
          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-medium transition-all">
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <ResetPasswordFormContent />
      </Suspense>
    </div>
  )
}
