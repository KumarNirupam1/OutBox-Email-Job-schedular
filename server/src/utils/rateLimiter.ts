import { redisConnection } from '../lib/redis';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  nextAvailableAt?: number; // Timestamp when the job can be retried
}

export async function checkRateLimit(
  senderId: string,
  maxEmailsPerHour: number
): Promise<RateLimitResult> {
  const hourWindow = Math.floor(Date.now() / 3600000);
  const rateLimitKey = `ratelimit:${senderId}:${hourWindow}`;

  // Atomic increment
  const currentCount = await redisConnection.incr(rateLimitKey);

  // Set TTL to 1 hour ONLY on the first increment of this window
  if (currentCount === 1) {
    await redisConnection.expire(rateLimitKey, 3600);
  }

  // Check if over the limit
  if (currentCount > maxEmailsPerHour) {
    // Rollback the increment since we aren't actually sending it this hour
    await redisConnection.decr(rateLimitKey);

    // Calculate exact timestamp for the start of the next hour
    const nextHourBoundary = (hourWindow + 1) * 3600000;
    
    // Add a tiny random offset (e.g., 100-1000ms) to prevent thundering herd 
    // if multiple jobs are rescheduled to the exact same millisecond
    const jitter = Math.floor(Math.random() * 900) + 100;

    return {
      allowed: false,
      currentCount,
      nextAvailableAt: nextHourBoundary + jitter,
    };
  }

  return {
    allowed: true,
    currentCount,
  };
}