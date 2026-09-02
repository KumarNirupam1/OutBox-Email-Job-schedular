import Redis from 'ioredis';
import "dotenv/config";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is not set');
}

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  tls: redisUrl.startsWith('rediss://') ? {
    rejectUnauthorized: false, // Required for Upstash
  } : undefined,
});

redisConnection.on('connect', () => console.log('✅ Redis (Upstash) Connected'));
redisConnection.on('error', (err) => console.error('❌ Redis Error:', err));