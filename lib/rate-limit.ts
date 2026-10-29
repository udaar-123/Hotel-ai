import { NextResponse } from "next/server";

interface RateLimitOptions {
  /** Unique namespace for the route (e.g., 'chat', 'voice-tts', 'voice-stt') */
  namespace: string;
  /** Maximum requests allowed within the sliding window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
  headers: Record<string, string>;
}

const buckets = new Map<string, number[]>();
let lastCleanup = Date.now();

function cleanupStaleBuckets(maxWindowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;

  for (const [key, timestamps] of buckets.entries()) {
    const valid = timestamps.filter((t) => now - t < maxWindowMs);
    if (valid.length === 0) {
      buckets.delete(key);
    } else {
      buckets.set(key, valid);
    }
  }
}

export function getClientIdentifier(req: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return `ip:${forwarded.split(",")[0].trim()}`;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return `ip:${realIp.trim()}`;
  return "ip:local";
}

export function checkRateLimit(identifier: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanupStaleBuckets(Math.max(options.windowMs, 120_000));

  const key = `${options.namespace}:${identifier}`;
  const existing = buckets.get(key) || [];
  const windowStart = now - options.windowMs;
  const activeTimestamps = existing.filter((t) => t > windowStart);

  if (activeTimestamps.length >= options.limit) {
    const oldest = activeTimestamps[0] || now;
    const resetInSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetInSeconds,
      headers: {
        "X-RateLimit-Limit": String(options.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(resetInSeconds),
        "Retry-After": String(resetInSeconds),
      },
    };
  }

  activeTimestamps.push(now);
  buckets.set(key, activeTimestamps);

  const remaining = Math.max(0, options.limit - activeTimestamps.length);
  const resetInSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));

  return {
    allowed: true,
    limit: options.limit,
    remaining,
    resetInSeconds,
    headers: {
      "X-RateLimit-Limit": String(options.limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(resetInSeconds),
    },
  };
}

export function rateLimitExceededResponse(result: RateLimitResult, language: string = "en-IN") {
  const isHindi = language === "hi-IN";
  const message = isHindi
    ? `बहुत अधिक अनुरोध भेजे गए हैं। कृपया ${result.resetInSeconds} सेकंड बाद पुनः प्रयास करें।`
    : `Rate limit exceeded. Please wait ${result.resetInSeconds} seconds before trying again.`;

  return NextResponse.json(
    {
      error: message,
      retryAfterSeconds: result.resetInSeconds,
    },
    {
      status: 429,
      headers: result.headers,
    }
  );
}
