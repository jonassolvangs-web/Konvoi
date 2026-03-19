import puppeteer from 'puppeteer';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Replace local image URLs (/uploads/...) with base64 data URIs
 * so Puppeteer can render them without needing a running server.
 */
async function embedLocalImages(html: string): Promise<string> {
  const imgRegex = /<img\s+[^>]*src="([^"]*\/uploads\/[^"]+)"[^>]*>/g;
  const matches = [...html.matchAll(imgRegex)];

  for (const match of matches) {
    const srcUrl = match[1];
    // Strip any leading http://host:port prefix to get the relative path
    const relativePath = srcUrl.replace(/^https?:\/\/[^/]+/, '');
    const filePath = path.join(process.cwd(), 'public', relativePath);

    try {
      const fileBuffer = await readFile(filePath);
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const dataUri = `data:${mime};base64,${fileBuffer.toString('base64')}`;
      html = html.replace(srcUrl, dataUri);
    } catch {
      // File not found — leave the original URL
    }
  }

  return html;
}

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  html = await embedLocalImages(html);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
