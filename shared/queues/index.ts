import { Queue } from 'bullmq'
import Redis from 'ioredis'

// Connect to Redis for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required by BullMQ
})

export const otpQueue = new Queue('otp-queue', { connection: redisConnection })
export const emailQueue = new Queue('email-queue', { connection: redisConnection })

export type OtpJobPayload = {
  identifier: string
  otp: string
}

export type EmailJobPayload = {
  to: string
  subject: string
  body: string
}
