import { Router } from 'express';
import { scrapeLinkedInProfile } from '../services/linkedinService';

const router = Router();

router.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'LinkedIn URL is required' });
  }

  try {
    const data = await scrapeLinkedInProfile(url);
    res.json(data);
  } catch (err: any) {
    console.error('LinkedIn scrape error:', err);
    res.status(422).json({ error: err.message || 'Failed to scrape LinkedIn profile' });
  }
});

export default router;
