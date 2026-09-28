import { Worker } from 'bullmq'
import Redis from 'ioredis'
import resend from '@/lib/resend'
import type { OtpJobPayload, EmailJobPayload } from '@/shared/queues'

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

// OTP Worker — delivers OTP via email/phone
export const otpWorker = new Worker<OtpJobPayload>(
  'otp-queue',
  async (job) => {
    const { identifier, otp } = job.data
    const isEmail = identifier.includes('@')

    if (isEmail) {
      await resend.emails.send({
        from: 'noreply@yourdomain.com',
        to: identifier,
        subject: 'Your OTP Code',
        html: `<p>Your one-time password is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
      })
    } else {
      // SMS integration placeholder — wire Twilio or similar here
      console.log(`[OTP Worker] SMS OTP for ${identifier}: ${otp}`)
    }
  },
  { connection }
)

// Email Worker — generic transactional emails
export const emailWorker = new Worker<EmailJobPayload>(
  'email-queue',
  async (job) => {
    const { to, subject, body } = job.data
    await resend.emails.send({
      from: 'noreply@yourdomain.com',
      to,
      subject,
      html: body,
    })
  },
  { connection }
)

otpWorker.on('failed', (job, err) => {
  console.error(`[OTP Worker] Job ${job?.id} failed:`, err)
})

emailWorker.on('failed', (job, err) => {
  console.error(`[Email Worker] Job ${job?.id} failed:`, err)
})
