import Redis from 'ioredis'

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    })
    redis.on('error', () => {
      // Suppress noisy connection errors — rate limiter will just allow requests
      redis = null
    })
    return redis
  } catch {
    return null
  }
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Token-bucket style rate limiter backed by Redis.
 * If Redis is unavailable, all requests are allowed (fail-open).
 * @param key     Unique identifier (e.g. "ratelimit:otp:+91xxxxxxxx")
 * @param limit   Max requests allowed
 * @param windowS Window in seconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowS: number
): Promise<RateLimitResult> {
  const client = getRedis()

  if (!client) {
    // Redis unavailable — fail open, allow request
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowS * 1000 }
  }

  try {
    const current = await client.incr(key)
    if (current === 1) {
      await client.expire(key, windowS)
    }
    const ttl = await client.ttl(key)

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetAt: Date.now() + ttl * 1000,
    }
  } catch {
    // Redis error mid-request — fail open
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowS * 1000 }
  }
}
