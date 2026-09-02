import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../lib/auth';
import { prisma } from '../lib/db';
import { emailQueue } from '../lib/queue';

const router = Router();

// Relaxed validation schema for better compatibility
const scheduleSchema = z.object({
  recipientEmail: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  senderId: z.string().min(1),
  scheduledAt: z.string(), // We will parse this as a Date manually
});

// POST /api/emails/schedule
router.post('/schedule', async (req, res) => {
  try {
    // 1. Authenticate
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Validate payload
    const validatedData = scheduleSchema.parse(req.body);

    // 3. Verify date is valid
    const scheduledDate = new Date(validatedData.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt date format' });
    }

    // 4. Verify sender belongs to this user
    const sender = await prisma.sender.findFirst({
      where: { id: validatedData.senderId, userId: session.user.id },
    });
    if (!sender) {
      return res.status(403).json({ error: 'Invalid sender' });
    }

    // 5. Create EmailJob in DB
    const emailJob = await prisma.emailJob.create({
      data: {
        userId: session.user.id,
        senderId: validatedData.senderId,
        recipientEmail: validatedData.recipientEmail,
        subject: validatedData.subject,
        body: validatedData.body,
        scheduledAt: scheduledDate,
        status: 'PENDING',
      },
    });

    // 6. Calculate delay in milliseconds
    const delayMs = Math.max(0, scheduledDate.getTime() - Date.now());

    // 7. Add to BullMQ Queue
    await emailQueue.add('send-email', 
      { emailJobId: emailJob.id },
      { 
        jobId: emailJob.id, 
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    console.log(`✅ Scheduled email job ${emailJob.id} with ${delayMs}ms delay`);

    res.status(201).json({ 
      message: 'Email scheduled successfully', 
      jobId: emailJob.id 
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      // This will now show you exactly which field failed validation
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('❌ Schedule error:', error);
    res.status(500).json({ error: 'Failed to schedule email' });
  }
});

export default router;