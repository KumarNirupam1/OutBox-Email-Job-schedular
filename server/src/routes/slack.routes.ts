import { Router } from 'express';
import crypto from 'node:crypto';
import { auth } from '../lib/auth';
import { prisma } from '../lib/db.js';

const router = Router();

function signSlackState(userId: string): string {
  const signature = crypto
    .createHmac('sha256', process.env.BETTER_AUTH_SECRET ?? '')
    .update(userId)
    .digest('hex');
  return `${userId}.${signature}`;
}

function isValidSlackState(state: string): boolean {
  const separator = state.lastIndexOf('.');
  if (separator < 1) return false;

  const userId = state.slice(0, separator);
  const signature = state.slice(separator + 1);
  const expectedSignature = signSlackState(userId).slice(separator + 1);

  return signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

type SlackOAuthResponse = {
  ok: boolean;
  incoming_webhook: {
    url: string;
    channel: string;
  };
  team?: {
    name?: string;
  };
};

// GET /api/slack/connect - Initiates Slack OAuth flow
router.get('/connect', async (req, res) => {
  try {
    // Get user session
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Redirect to Slack OAuth
    const slackClientId = process.env.SLACK_CLIENT_ID;
    if (!slackClientId || !process.env.SLACK_CLIENT_SECRET) {
      return res.status(503).json({ error: 'Slack OAuth is not configured' });
    }

    const redirectUri = encodeURIComponent(`${process.env.BACKEND_URL ?? 'http://localhost:8080'}/api/slack/callback`);
    const scopes = 'incoming-webhook';
    
    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(slackClientId)}&scope=${scopes}&redirect_uri=${redirectUri}&state=${encodeURIComponent(signSlackState(session.user.id))}`;
    
    res.redirect(slackAuthUrl);
  } catch (error) {
    console.error('Slack connect error:', error);
    res.status(500).json({ error: 'Failed to initiate Slack OAuth' });
  }
});

// GET /api/slack/callback - Handles Slack OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    if (typeof state !== 'string' || !isValidSlackState(state)) {
      return res.status(401).json({ error: 'Invalid state parameter' });
    }

    const stateUserId = state.slice(0, state.lastIndexOf('.'));
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user || session.user.id !== stateUserId) {
      return res.status(401).json({ error: 'Invalid state parameter' });
    }

    // Exchange code for webhook URL
    const redirectUri = `${process.env.BACKEND_URL ?? 'http://localhost:8080'}/api/slack/callback`;
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code: code as string,
        redirect_uri: redirectUri,
      }),
    });

    const data = (await response.json()) as SlackOAuthResponse;

    if (!data.ok) {
      console.error('Slack OAuth error:', data);
      return res.status(500).json({ error: 'Failed to exchange code' });
    }

    // Store webhook URL in database
    await prisma.slackIntegration.upsert({
      where: { userId: session.user.id },
      update: {
        webhookUrl: data.incoming_webhook?.url,
        channelName: data.incoming_webhook?.channel,
        teamName: data.team?.name,
      },
      create: {
        userId: session.user.id,
        webhookUrl: data.incoming_webhook?.url,
        channelName: data.incoming_webhook?.channel,
        teamName: data.team?.name,
      },
    });

    // Redirect to frontend dashboard
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (error) {
    console.error('Slack callback error:', error);
    res.status(500).json({ error: 'Failed to complete Slack OAuth' });
  }
});

// GET /api/slack/status - Check if Slack is connected
router.get('/status', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const integration = await prisma.slackIntegration.findUnique({
      where: { userId: session.user.id },
    });

    res.json({
      connected: !!integration,
      channelName: integration?.channelName,
      teamName: integration?.teamName,
    });
  } catch (error) {
    console.error('Slack status error:', error);
    res.status(500).json({ error: 'Failed to get Slack status' });
  }
});

export default router;