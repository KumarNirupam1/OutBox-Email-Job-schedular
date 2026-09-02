import { esClient } from '../lib/elastic';
import { prisma } from '../lib/db';

const INDEX_NAME = 'email_jobs';

// Index or update an email job in Elasticsearch
export async function indexEmailJob(emailJob: any) {
  if (!esClient) {
    return;
  }

  try {
    await esClient.index({
      index: INDEX_NAME,
      id: emailJob.id, // Use DB ID as ES ID for easy updates
      document: {
        id: emailJob.id,
        userId: emailJob.userId,
        recipientEmail: emailJob.recipientEmail,
        subject: emailJob.subject,
        body: emailJob.body,
        status: emailJob.status,
        scheduledAt: emailJob.scheduledAt,
        sentAt: emailJob.sentAt,
      },
    });
  } catch (error) {
    console.error('❌ Failed to index to Elasticsearch:', error);
    // Don't throw, we don't want to break the main flow if ES is down
  }
}

// Search emails in Elasticsearch
export async function searchEmails(userId: string, query: string) {
  try {
    if (!esClient) {
      throw new Error('Elasticsearch is not configured');
    }

    const response = await esClient.search({
      index: INDEX_NAME,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['recipientEmail', 'subject', 'body'],
              },
            },
          ],
          filter: [{ term: { userId } }],
        },
      },
      sort: [{ scheduledAt: 'desc' }],
      size: 50,
    });

    return response.hits.hits.flatMap((hit) =>
      hit._source ? [hit._source] : [],
    );
  } catch (error) {
    console.error('❌ Elasticsearch search failed, falling back to Postgres:', error);
    
    // SENIOR MOVE: Fallback to Postgres if ES is down!
    return await prisma.emailJob.findMany({
      where: {
        userId,
        OR: [
          { recipientEmail: { contains: query, mode: 'insensitive' } },
          { subject: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
    });
  }
}