import { Router } from 'express';
import { auth } from '../lib/auth';
import { searchEmails } from '../services/search.service';

const router = Router();

const VALID_STATUSES = ['PENDING', 'SENT', 'FAILED'];

// GET /api/emails/search?q=...&status=PENDING|SENT,FAILED
router.get('/search', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { q, status } = req.query;
    if (!q || typeof q !== 'string' || q.trim() === '') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    let statuses: string[] | undefined;
    if (status) {
      if (typeof status !== 'string') {
        return res.status(400).json({ error: 'Invalid "status" parameter' });
      }

      statuses = status
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter((value) => VALID_STATUSES.includes(value));

      if (statuses.length === 0) {
        return res.status(400).json({ error: 'Invalid "status" parameter' });
      }
    }

    const results = await searchEmails(session.user.id, q, statuses);

    res.json({
      query: q,
      status: statuses,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;