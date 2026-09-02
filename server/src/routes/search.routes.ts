import { Router } from 'express';
import { auth } from '../lib/auth';
import { searchEmails } from '../services/search.service';

const router = Router();

// GET /api/emails/search?q=...
router.get('/search', async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = await searchEmails(session.user.id, q);

    res.json({
      query: q,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;