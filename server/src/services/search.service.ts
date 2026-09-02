import { esClient } from '../lib/elastic';
import { prisma } from '../lib/db';
import type { EmailStatus } from '../generated/prisma/enums.js';

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
        attachmentNames: (emailJob.attachments ?? []).map((a: any) => a?.name).filter(Boolean),
      },
    });
  } catch (error) {
    console.error('❌ Failed to index to Elasticsearch:', error);
    // Don't throw, we don't want to break the main flow if ES is down
  }
}

// Search emails in Elasticsearch
export async function searchEmails(userId: string, query: string, statuses?: string[]) {
  // Build the status filter for reuse across ES and Postgres paths.
  const statusTerms =
    statuses && statuses.length > 0
      ? statuses.map((value) => ({ term: { status: value } }))
      : undefined;

  try {
    if (!esClient) {
      throw new Error('Elasticsearch is not configured');
    }

    const filter: any[] = [{ term: { userId } }];
    if (statusTerms) {
      filter.push({ bool: { should: statusTerms, minimum_should_match: 1 } });
    }

    const response = await esClient.search({
      index: INDEX_NAME,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['recipientEmail', 'subject', 'body', 'attachmentNames'],
              },
            },
          ],
          filter,
        },
      },
      sort: [{ scheduledAt: 'desc' }],
      size: 50,
    });

    const sourceIds = response.hits.hits.flatMap((hit) =>
      hit._source && (hit._source as { id?: string }).id
        ? [(hit._source as { id?: string }).id as string]
        : [],
    );

    // Return nothing if ES matched no documents.
    if (sourceIds.length === 0) {
      return [];
    }

    // Fetch the full records (with sender) from Postgres so the response
    // shape matches what the rest of the app expects.
    return await prisma.emailJob.findMany({
      where: {
        userId,
        id: { in: sourceIds },
        ...(statusTerms && { status: { in: statuses as EmailStatus[] } }),
      },
      include: { sender: true },
      orderBy: { scheduledAt: 'desc' },
    });
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
        ...(statuses && statuses.length > 0 && { status: { in: statuses as EmailStatus[] } }),
      },
      include: { sender: true },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
    });
  }
}