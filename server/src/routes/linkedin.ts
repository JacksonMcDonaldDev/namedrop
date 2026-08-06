import { Router } from 'express';
import {
  scrapeLinkedInProfile,
  LINKEDIN_PROFILE_URL,
  INVALID_URL_MESSAGE,
} from '../services/linkedinService';

const router = Router();

router.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'LinkedIn URL is required' });
  }
  // A URL we can reject without leaving the process is a client error, like
  // every other validation failure here. 422 stays for the scrape itself,
  // which fails for reasons the caller cannot fix by editing the request.
  if (!LINKEDIN_PROFILE_URL.test(url)) {
    return res.status(400).json({ error: INVALID_URL_MESSAGE });
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
