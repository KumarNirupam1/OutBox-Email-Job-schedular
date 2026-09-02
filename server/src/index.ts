import "dotenv/config";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from './lib/auth';
import cors from "cors";


import slackRoutes from './routes/slack.routes';
import emailRoutes from './routes/email.routes';


import { emailWorker } from './workers/email.worker';
import { emailQueue } from './lib/queue';


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
app.use('/api/slack', slackRoutes);
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
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📊 Bull Board Dashboard: http://localhost:${port}/admin/queues`);
  console.log(`🔗 Frontend URL allowed: ${frontendUrl}`);
});