import { Client } from '@elastic/elasticsearch';

const elasticsearchUrl = process.env.ELASTICSEARCH_URL;
const elasticsearchApiKey = process.env.ELASTICSEARCH_API_KEY;

if (elasticsearchUrl && !/^https:\/\//i.test(elasticsearchUrl)) {
  console.warn('⚠️ ELASTICSEARCH_URL is not using https://. Use http:// only for local Elasticsearch.');
}

export const esClient = elasticsearchUrl
  ? new Client({
      node: elasticsearchUrl,
      ...(elasticsearchApiKey
        ? { auth: { apiKey: elasticsearchApiKey } }
        : process.env.ELASTICSEARCH_PASSWORD
        ? {
            auth: {
              username: process.env.ELASTICSEARCH_USERNAME ?? 'elastic',
              password: process.env.ELASTICSEARCH_PASSWORD,
            },
          }
        : {}),
      ...(elasticsearchUrl.startsWith('https://localhost')
        ? { tls: { rejectUnauthorized: false } }
        : {}),
    })
  : null;

export async function ensureEmailIndex() {
  if (!esClient) {
    console.warn('⚠️ ELASTICSEARCH_URL is not configured. Elasticsearch is disabled; Postgres search fallback will be used.');
    return;
  }

  const indexName = 'email_jobs';
  const exists = await esClient.indices.exists({ index: indexName });

  if (!exists) {
    await esClient.indices.create({
      index: indexName,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          userId: { type: 'keyword' },
          recipientEmail: { type: 'text', analyzer: 'standard' },
          subject: { type: 'text', analyzer: 'standard' },
          body: { type: 'text', analyzer: 'standard' },
          status: { type: 'keyword' },
          scheduledAt: { type: 'date' },
          sentAt: { type: 'date' },
        },
      },
    });
    console.log('✅ Elasticsearch index "email_jobs" created.');
  } else {
    console.log('✅ Elasticsearch index "email_jobs" is ready.');
  }
}