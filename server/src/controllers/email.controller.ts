import type { Request, Response } from 'express';
import { prisma } from '../lib/db.js';

export class EmailController {
  static async list(req: Request, res: Response) {
    const userId = req.session?.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const jobs = await prisma.emailJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(jobs);
  }
}
