import { Queue } from 'bullmq';
import { redisConnection } from './redis';

// The queue name
export const emailQueue = new Queue('email-sending', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 1000, // Keep last 1000 completed jobs in history
    removeOnFail: 5000,     // Keep last 5000 failed jobs
  },
});