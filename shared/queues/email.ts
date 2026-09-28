import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const EmailQueue = new Queue("EmailQueue", { connection });

// In a real application, the worker might be running in a separate process.
// For development, we can run it here.
export const EmailWorker = new Worker(
  "EmailQueue",
  async (job) => {
    const { to, subject, body } = job.data;
    console.log(`[EMAIL WORKER] Sending to ${to} - Subject: ${subject}`);
    console.log(`[EMAIL WORKER] Body: ${body}`);
    // Here we'd call Resend API
  },
  { connection }
);
