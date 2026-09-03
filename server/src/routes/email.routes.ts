import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../lib/auth';
import { prisma } from '../lib/db';
import { emailQueue } from '../lib/queue';
import { indexEmailJob } from '../services/search.service';
import { emailSchema, validateAttachmentsSize } from '../validators/email.validator';

const router = Router();


// POST /api/emails/schedule
router.post('/schedule', async (req, res) => {
  try {
    // 1. Authenticate
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Validate payload
    const validatedData = emailSchema.parse(req.body);

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

    // 4b. Reject oversized attachment payloads
    if (!validateAttachmentsSize(validatedData.attachments)) {
      return res.status(413).json({ error: 'Attachments exceed the size limit' });
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
        attachments: validatedData.attachments && validatedData.attachments.length > 0
          ? (validatedData.attachments as any)
          : null,
      },
    });

    //Index in Elasticsearch immediately
    await indexEmailJob(emailJob);

    // 6. Calculate delay in milliseconds
    const delayMs = Math.max(0, scheduledDate.getTime() - Date.now());

    // 7. Add to BullMQ Queue. The DB row is removed if enqueueing fails so
    // an accepted PENDING row cannot become an orphan with no worker job.
    try {
      await emailQueue.add('send-email',
        { emailJobId: emailJob.id },
        {
          jobId: emailJob.id,
          delay: delayMs,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
    } catch (queueError) {
      await prisma.emailJob.delete({ where: { id: emailJob.id } });
      throw queueError;
    }

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

router.get('/scheduled', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const jobs = await prisma.emailJob.findMany({
      where: { userId: session.user.id, status: 'PENDING' },
      include: { sender: true },
      orderBy: { scheduledAt: 'asc' },
    });

    return res.json(jobs);
  } catch (error) {
    console.error('❌ Scheduled emails error:', error);
    return res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

router.get('/sent', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const jobs = await prisma.emailJob.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['SENT', 'FAILED'] },
      },
      include: { sender: true },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json(jobs);
  } catch (error) {
    console.error('❌ Sent emails error:', error);
    return res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const emailJob = await prisma.emailJob.findFirst({
      where: { id: req.params.id, userId: session.user.id },
      include: { sender: true },
    });

    if (!emailJob) {
      return res.status(404).json({ error: 'Email not found' });
    }

    return res.json(emailJob);
  } catch (error) {
    console.error('❌ Email detail error:', error);
    return res.status(500).json({ error: 'Failed to fetch email' });
  }
});

export default router;