import { Injectable, Logger } from '@nestjs/common';

export interface LighthouseIssue {
  id: string;
  title: string;
  description: string;
  snippets: string[];
}

export interface LighthouseReport {
  url: string;
  strategy: 'mobile' | 'desktop';
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
  lcpElement: string | null;   // What triggered LCP
  clsElements: string[];       // Elements causing layout shift
  issues: LighthouseIssue[];   // Extracted failing audits
}

@Injectable()
export class PageSpeedService {
  private readonly apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  private readonly logger = new Logger(PageSpeedService.name);

  async auditPage(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<LighthouseReport> {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`
      + `?url=${encodeURIComponent(url)}`
      + `&strategy=${strategy}`
      + `&category=performance&category=accessibility&category=seo&category=best-practices`
      + (this.apiKey ? `&key=${this.apiKey}` : '');

    let result: any = null;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        result = await response.json();
        
        if (result.error) {
          throw new Error(`PageSpeed API Error: ${result.error.message}`);
        }
        break; // Success
      } catch (err: any) {
        attempt++;
        if (attempt >= maxAttempts) {
          throw new Error(`PageSpeed API failed after ${maxAttempts} attempts: ${err.message}`);
        }
        this.logger.warn(`PageSpeed API failed (attempt ${attempt}/${maxAttempts}). Retrying in ${attempt * 5}s...`);
        await new Promise(r => setTimeout(r, attempt * 5000));
      }
    }

    const audits = result.lighthouseResult.audits;
    const categories = result.lighthouseResult.categories;
    
    // Extract failed audits with their snippets
    const issues: LighthouseIssue[] = [];
    for (const key of Object.keys(audits)) {
      const audit = audits[key];
      // A score < 1 means it didn't fully pass. We ignore null (not applicable).
      if (audit.score !== null && audit.score < 1) {
        const snippets: string[] = [];
        if (audit.details && audit.details.items) {
          for (const item of audit.details.items) {
            if (item.node && item.node.snippet) {
              snippets.push(item.node.snippet);
            }
          }
        }
        
        // Only include it if it's considered an error/warning (score < 0.9 usually, or just score < 1 for strictness)
        issues.push({
          id: audit.id,
          title: audit.title,
          description: audit.description,
          snippets
        });
      }
    }

    return {
      url,
      strategy,
      performance: Math.round(categories.performance.score * 100),
      accessibility: Math.round(categories.accessibility.score * 100),
      seo: Math.round(categories.seo.score * 100),
      bestPractices: Math.round(categories['best-practices'].score * 100),
      lcpElement: audits['largest-contentful-paint-element']?.details?.items?.[0]?.node?.snippet || null,
      clsElements: audits['layout-shift-elements']?.details?.items?.map(
        (item: any) => item.node?.snippet
      ) || [],
      issues
    };
  }

  /**
   * Audit key pages with both mobile and desktop strategies.
   * Rate limited: ~25 req/100 seconds for free tier.
   */
  async auditAllPages(sitemapUrls: string[]): Promise<LighthouseReport[]> {
    const reports: LighthouseReport[] = [];
    let i = 1;
    for (const url of sitemapUrls) {
      this.logger.log(`[${i}/${sitemapUrls.length}] Auditing page performance: ${url}`);
      try {
        // Mobile + Desktop concurrently for the same page
        const [mobile, desktop] = await Promise.all([
          this.auditPage(url, 'mobile'),
          this.auditPage(url, 'desktop'),
        ]);
        reports.push(mobile, desktop);
        this.logger.log(`[${i}/${sitemapUrls.length}] ✓ Finished ${url} (Mobile: ${mobile.performance}, Desktop: ${desktop.performance})`);
      } catch (err: any) {
        this.logger.error(`Failed to audit ${url}: ${err.message}`);
      }
      // Stagger between pages to respect rate limits
      await new Promise(r => setTimeout(r, 2000));
      i++;
    }
    return reports;
  }
}
