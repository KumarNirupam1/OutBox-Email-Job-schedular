import "dotenv/config";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from './lib/auth';
import cors from "cors";
import { ensureEmailIndex } from './lib/elastic';


import slackRoutes from './routes/slack.routes';
import emailRoutes from './routes/email.routes';
import searchRoutes from './routes/search.routes';
import senderRoutes from './routes/sender.routes';
import oauthRoutes from './routes/oauth.routes';


import { emailWorker } from './workers/email.worker';
import { emailQueue } from './lib/queue';

// Keep the worker module active when this entrypoint is bundled or transpiled.
void emailWorker;


import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const app = express();
const port = process.env.PORT ?? 8080;
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";


app.use(cors({
  origin: frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));


app.use(express.json());



app.all('/api/auth/{*path}', toNodeHandler(auth));

// App routes
app.use('/api/oauth', oauthRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/senders', senderRoutes);
// NOTE: searchRoutes must be registered BEFORE emailRoutes. Otherwise the
// GET /api/emails/:id catch-all in emailRoutes would swallow /api/emails/search.
app.use('/api/emails', searchRoutes);
app.use('/api/emails', emailRoutes);

// Bull Board Dashboard (Live Queue Visibility)
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', backendUrl });
});

app.get('/', (_req, res) => {
  res.json({ message: "OutBox Email Scheduler API is running" });
});
async function startServer() {
  try {
    await ensureEmailIndex();
  } catch (error) {
    console.error('⚠️ Elasticsearch startup check failed. Continuing with Postgres search fallback:', error);
  }

  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📊 Bull Board Dashboard: http://localhost:${port}/admin/queues`);
    console.log(`🔗 Frontend URL allowed: ${frontendUrl}`);
  });
}

void startServer();