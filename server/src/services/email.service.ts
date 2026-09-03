import type { EmailStatus } from '../generated/prisma/enums.js';
import { prisma } from '../lib/db.js';

export class EmailService {
  static async getEmails(userId: string, status?: EmailStatus) {
    return prisma.emailJob.findMany({
      where: { userId, ...(status ? { status } : {}) },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
