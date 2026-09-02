import { prisma } from '../lib/db.js';

export class SlackService {
  static async getIntegration(userId: string) {
    return prisma.slackIntegration.findUnique({
      where: { userId },
      select: {
        id: true,
        channelName: true,
        teamName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
