import dotenv from 'dotenv';

dotenv.config();

import { DelayedError, Job, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { redisConnection } from '../lib/redis';
import { prisma } from '../lib/db';
import { getEtherealTransporter } from '../utils/ethereal';
import { sendSlackNotification } from '../utils/slack';
import { checkRateLimit, resolvePerSenderLimit } from '../utils/rateLimiter';
import { indexEmailJob } from '../services/search.service'; 

// Configurable limits from .env
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_MS || '2000', 10);
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

console.log(`MAX_EMAILS_PER_HOUR=${process.env.MAX_EMAILS_PER_HOUR ?? '<not set>'}`);
console.log(`MAX_EMAILS_PER_HOUR_PER_SENDER=${process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? '<not set>'}`);

export const emailWorker = new Worker(
  'email-sending',
  async (job: Job) => {
    const { emailJobId } = job.data;
    console.log(`📧 Processing job ${job.id} for EmailJob ${emailJobId}`);

    try {
      // 1. Fetch job details, sender, AND user (for Slack lookup)
      const emailJob = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
        include: { sender: true, user: true },
      });

      if (!emailJob) {
        throw new Error(`EmailJob ${emailJobId} not found in database`);
      }

      if (emailJob.status === 'SENT' || emailJob.status === 'FAILED') {
        console.log(`⚠️ Job ${emailJobId} already processed. Skipping.`);
        return;
      }

      // ==========================================
      // 2. RATE LIMITING CHECK
      // ==========================================
      // Resolve the hourly limit for THIS sender (per-sender, falling back to
      // a global default). The Redis counter is already keyed per sender, so
      // each sender is rate-limited independently.
      const maxEmailsPerHour = resolvePerSenderLimit(emailJob.sender.email);
      const rateLimitResult = await checkRateLimit(emailJob.senderId, maxEmailsPerHour);

      if (!rateLimitResult.allowed && rateLimitResult.nextAvailableAt) {
        console.log(`⚠️ Rate limit hit (${rateLimitResult.currentCount}/${maxEmailsPerHour} for sender ${emailJob.sender.email}). Rescheduling job to ${new Date(rateLimitResult.nextAvailableAt).toISOString()}`);
        
        // Reschedule the job into the next hour window
        await job.moveToDelayed(rateLimitResult.nextAvailableAt);

        // Notification failure must not turn an already-delayed job into a failed job.
        if (emailJob.user) {
          try {
            await sendSlackNotification(
              emailJob.user.id,
              `🚨 *Rate Limit Hit*\nSender: ${emailJob.sender.email}\nLimit: ${maxEmailsPerHour}/hr\nEmail to ${emailJob.recipientEmail} has been delayed to the next hour.`
            );
          } catch (notificationError) {
            console.error('⚠️ Rate-limit Slack notification failed:', notificationError);
          }
        }

        // BullMQ requires this signal after moveToDelayed() so it does not
        // attempt to complete the job that is already in the delayed set.
        throw new DelayedError();
      }
      // ==========================================
      // END RATE LIMITING LOGIC
      // ==========================================

      // 3. Send the email
      const transporter = getEtherealTransporter(emailJob.sender);

      // Build nodemailer attachments from the stored JSON (base64-decoded).
      const attachments: any[] = (emailJob.attachments as any[] | null)?.map((a: any) => ({
        filename: a?.name,
        contentType: a?.type || undefined,
        content: a?.base64 ? Buffer.from(a.base64, 'base64') : undefined,
      })) ?? [];

      const info = await transporter.sendMail({
        from: `"OutBox Scheduler" <${emailJob.sender.email}>`,
        to: emailJob.recipientEmail,
        subject: emailJob.subject,
        text: emailJob.body,
        html: `<p>${emailJob.body}</p>`,
        ...(attachments.length > 0 ? { attachments } : {}),
      });

      console.log(`✅ Email sent to ${emailJob.recipientEmail}. Preview: ${nodemailer.getTestMessageUrl(info)}`);

       // 4. Update DB status to SENT
      const updatedJob = await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      // Update Elasticsearch with new status
      await indexEmailJob(updatedJob);

    } catch (error: any) {
      if (error instanceof DelayedError) {
        throw error;
      }

      console.error(`❌ Failed to process job ${emailJobId}:`, error.message);
      
      // Only mark as FAILED in DB if it's a real error (not a rate limit delay)
      const failedJob = await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });
      await indexEmailJob(failedJob);
      
      // Re-throw to let BullMQ know it failed so it can retry based on its own retry config
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: CONCURRENCY,
    limiter: {
      max: 1,
      duration: MIN_DELAY_MS, // Minimum delay between individual sends
    },
  }
);

emailWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed with error:`, err.message);
});

console.log(`🚀 Email Worker started (Concurrency: ${CONCURRENCY}, Min Delay: ${MIN_DELAY_MS}ms, Default Max/Hr: ${process.env.MAX_EMAILS_PER_HOUR ?? '200'}, Per-Sender Max/Hr: ${process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? '<inherit>'})`);