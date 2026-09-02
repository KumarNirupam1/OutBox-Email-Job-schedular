import { prisma } from '../lib/db';
import { IncomingWebhook } from '@slack/webhook';

export async function sendSlackNotification(userId: string, message: string) {
  try {
    // 1. Check if user has a Slack integration
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    // 2. If no webhook exists, silently no-op (no crash)
    if (!integration || !integration.webhookUrl) {
      console.log('No Slack integration found for user. Silently skipping notification.');
      return;
    }

    // 3. Send real webhook POST
    const webhook = new IncomingWebhook(integration.webhookUrl);
    await webhook.send({
      text: `*OutBox Rate Limit Alert*\n${message}`,
    });
    
    console.log('✅ Slack notification sent successfully.');
  } catch (error) {
    // Log error but DO NOT throw, we don't want to crash the worker if Slack fails
    console.error('Failed to send Slack notification:', error);
  }
}