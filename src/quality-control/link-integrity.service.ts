import { Injectable } from '@nestjs/common';

export interface LinkIntegrityReport {
  brokenLinks: { source: string; href: string; status: number }[];
  orphanPages: string[];
  missingFromSitemap: string[];
}

@Injectable()
export class LinkIntegrityService {
  /**
   * For each sitemap URL, fetch the HTML and extract all internal <a> hrefs.
   * Then verify every linked URL returns HTTP 200.
   */
  async checkLinks(sitemapUrls: string[]): Promise<LinkIntegrityReport> {
    const allLinkedUrls = new Set<string>();
    const brokenLinks: { source: string; href: string; status: number }[] = [];
    const sitemapSet = new Set(sitemapUrls);

    for (const pageUrl of sitemapUrls) {
      try {
        const html = await fetch(pageUrl).then(r => r.text());
        const hrefs = html.match(/href="(\/[^"]*?)"/g)
          ?.map(m => m.replace(/href="|"/g, '')) || [];

        const baseUrl = new URL(pageUrl).origin;
        for (const href of hrefs) {
          const fullUrl = `${baseUrl}${href}`;
          allLinkedUrls.add(fullUrl);

          // Check if the link resolves
          const res = await fetch(fullUrl, { method: 'HEAD' });
          if (res.status >= 400) {
            brokenLinks.push({ source: pageUrl, href, status: res.status });
          }
        }
      } catch (err: any) {
        console.error(`Failed to check links for ${pageUrl}:`, err.message);
      }
    }

    return {
      brokenLinks,
      orphanPages: sitemapUrls.filter(u => !allLinkedUrls.has(u)),
      missingFromSitemap: [...allLinkedUrls].filter(u => !sitemapSet.has(u)),
    };
  }
}
