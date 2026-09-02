import { Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
import { prisma } from '../lib/db.js';
import { getEtherealTransporter } from '../utils/ethereal.js';

export const emailWorker = new Worker(
  'email-sending',
  async (job: Job) => {
    const { emailJobId } = job.data;

    console.log(`📧 Processing job ${job.id} for EmailJob ${emailJobId}`);

    try {
      // 1. Fetch the job details and sender info from DB
      const emailJob = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
        include: { sender: true },
      });

      if (!emailJob) {
        throw new Error(`EmailJob ${emailJobId} not found in database`);
      }

      if (emailJob.status === 'SENT' || emailJob.status === 'FAILED') {
        console.log(`⚠️ Job ${emailJobId} already processed. Skipping.`);
        return;
      }

      // 2. Create Nodemailer transporter
      const transporter = getEtherealTransporter(emailJob.sender);

      // 3. Send the email
      const info = await transporter.sendMail({
        from: `"OutBox Scheduler" <${emailJob.sender.email}>`,
        to: emailJob.recipientEmail,
        subject: emailJob.subject,
        text: emailJob.body,
        html: `<p>${emailJob.body}</p>`,
      });

      console.log(`✅ Email sent to ${emailJob.recipientEmail}. Preview: ${nodemailer.getTestMessageUrl(info)}`);

      // 4. Update DB status to SENT
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });

    } catch (error: any) {
      console.error(`❌ Failed to send email for job ${emailJobId}:`, error.message);
      
      // Update DB status to FAILED
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });
      
      // Re-throw to let BullMQ know the job failed (it will retry based on config)
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Configurable concurrency (Phase 4 will make this dynamic)
  }
);

emailWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed with error:`, err.message);
});

console.log('🚀 Email Worker started and listening for jobs...');