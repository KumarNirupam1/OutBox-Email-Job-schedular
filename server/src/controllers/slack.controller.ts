import type { Request, Response } from 'express';
import { prisma } from '../lib/db.js';

export class SlackController {
  static async list(req: Request, res: Response) {
    const userId = req.session?.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
      select: { id: true, channelName: true, teamName: true, createdAt: true },
    });

    return res.json({ connected: Boolean(integration), integration });
  }
}
