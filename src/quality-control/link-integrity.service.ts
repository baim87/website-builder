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
    const checkedLinks = new Map<string, number>();
    const brokenLinks: { source: string; href: string; status: number }[] = [];
    const sitemapSet = new Set(sitemapUrls);

    for (const pageUrl of sitemapUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(pageUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`Status ${res.status}`);
        const html = await res.text();
        const hrefs = html.match(/href="(\/[^"]*?)"/g)
          ?.map(m => m.replace(/href="|"/g, '')) || [];

        const baseUrl = new URL(pageUrl).origin;
        for (const href of hrefs) {
          const fullUrl = `${baseUrl}${href}`;
          allLinkedUrls.add(fullUrl);

          // Check if we already verified this link
          if (checkedLinks.has(fullUrl)) {
             const cachedStatus = checkedLinks.get(fullUrl)!;
             if (cachedStatus >= 400) {
                brokenLinks.push({ source: pageUrl, href, status: cachedStatus });
             }
             continue;
          }

          // Check if the link resolves
          try {
             const controller = new AbortController();
             const timeoutId = setTimeout(() => controller.abort(), 10000);
             const headRes = await fetch(fullUrl, { method: 'HEAD', signal: controller.signal });
             clearTimeout(timeoutId);
             
             checkedLinks.set(fullUrl, headRes.status);
             if (headRes.status >= 400) {
               brokenLinks.push({ source: pageUrl, href, status: headRes.status });
             }
          } catch (e) {
             checkedLinks.set(fullUrl, 500);
             brokenLinks.push({ source: pageUrl, href, status: 500 });
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
