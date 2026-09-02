import { Router } from 'express';
import { auth } from '../lib/auth';
import { prisma } from '../lib/db';
import { createEtherealAccount } from '../utils/ethereal';

const router = Router();

// GET /api/senders
router.get('/', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const senders = await prisma.sender.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, smtpHost: true, smtpPort: true },
    });

    return res.json(senders);
  } catch (error) {
    console.error('❌ Fetch senders error:', error);
    return res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

// POST /api/senders
// Auto-creates an Ethereal SMTP sender tied to the logged-in user.
router.post('/', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Reuse an existing sender if one already exists for this user.
    const existing = await prisma.sender.findFirst({
      where: { userId: session.user.id },
    });
    if (existing) {
      return res.status(200).json(existing);
    }

    // Create a fresh Ethereal account so there are real SMTP credentials
    // behind the "sender = logged-in user" identity.
    const etherealAccount = await createEtherealAccount();

    const sender = await prisma.sender.create({
      data: {
        userId: session.user.id,
        email: session.user.email ?? etherealAccount.email,
        smtpHost: etherealAccount.smtpHost,
        smtpPort: etherealAccount.smtpPort,
        smtpUser: etherealAccount.smtpUser,
        smtpPass: etherealAccount.smtpPass,
      },
    });

    console.log(`✅ Created Sender for user ${session.user.id}: ${sender.email}`);

    return res.status(201).json(sender);
  } catch (error) {
    console.error('❌ Create sender error:', error);
    return res.status(500).json({ error: 'Failed to create sender' });
  }
});

export default router;
