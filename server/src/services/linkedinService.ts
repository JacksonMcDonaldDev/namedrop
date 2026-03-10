import * as cheerio from 'cheerio';

interface LinkedInProfile {
  first_name: string;
  last_name: string;
  company: string | null;
  headline: string | null;
  photo_base64: string | null;
}

export async function scrapeLinkedInProfile(url: string): Promise<LinkedInProfile> {
  // Validate URL
  if (!/^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?/.test(url)) {
    throw new Error('Invalid LinkedIn URL. Expected format: https://www.linkedin.com/in/username');
  }

  // Fetch the page with browser-like headers
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  });

  if (response.status === 999 || response.status === 403) {
    throw new Error('LinkedIn blocked the request. Try again later.');
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch LinkedIn page (status ${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract OG meta tags
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  const ogDescription = $('meta[property="og:description"]').attr('content');

  if (!ogTitle) {
    throw new Error('Could not extract profile data. The profile may be private or LinkedIn may have blocked the request.');
  }

  // Parse name and company from og:title
  // Format: "John Doe - Software Engineer - Acme Corp | LinkedIn"
  const titleWithoutLinkedIn = ogTitle.replace(/\s*\|\s*LinkedIn\s*$/, '');
  const segments = titleWithoutLinkedIn.split(' - ').map(s => s.trim());

  const fullName = segments[0] || '';
  const nameParts = fullName.split(/\s+/);
  const first_name = nameParts[0] || '';
  const last_name = nameParts.slice(1).join(' ') || '';

  // Company is typically the last segment (after title/role)
  const company = segments.length > 2 ? segments[segments.length - 1] : null;

  // Headline from og:description
  const headline = ogDescription?.replace(/\s*·.*$/, '').trim() || null;

  // Download profile photo and convert to base64
  let photo_base64: string | null = null;
  if (ogImage) {
    try {
      const imgResponse = await fetch(ogImage);
      if (imgResponse.ok) {
        const buffer = await imgResponse.arrayBuffer();
        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
        const base64 = Buffer.from(buffer).toString('base64');
        photo_base64 = `data:${contentType};base64,${base64}`;
      }
    } catch {
      // Photo download failed — continue without it
    }
  }

  return { first_name, last_name, company, headline, photo_base64 };
}
