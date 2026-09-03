import { Injectable } from '@nestjs/common';

export interface LighthouseReport {
  url: string;
  strategy: 'mobile' | 'desktop';
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
  screenshotBase64: string;    // From final-screenshot audit
  filmstrip: string[];         // From screenshot-thumbnails audit
  lcpElement: string | null;   // What triggered LCP
  clsElements: string[];       // Elements causing layout shift
}

@Injectable()
export class PageSpeedService {
  private readonly apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

  async auditPage(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<LighthouseReport> {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`
      + `?url=${encodeURIComponent(url)}`
      + `&strategy=${strategy}`
      + `&category=performance&category=accessibility&category=seo&category=best-practices`
      + (this.apiKey ? `&key=${this.apiKey}` : '');

    const response = await fetch(apiUrl);
    const result = await response.json();
    
    if (result.error) {
      throw new Error(`PageSpeed API Error: ${result.error.message}`);
    }

    const audits = result.lighthouseResult.audits;
    const categories = result.lighthouseResult.categories;

    return {
      url,
      strategy,
      performance: Math.round(categories.performance.score * 100),
      accessibility: Math.round(categories.accessibility.score * 100),
      seo: Math.round(categories.seo.score * 100),
      bestPractices: Math.round(categories['best-practices'].score * 100),
      // Screenshot from Google's headless Chrome render
      screenshotBase64: audits['final-screenshot']?.details?.data || '',
      filmstrip: audits['screenshot-thumbnails']?.details?.items?.map(
        (item: any) => item.data
      ) || [],
      lcpElement: audits['largest-contentful-paint-element']?.details?.items?.[0]?.node?.snippet || null,
      clsElements: audits['layout-shift-elements']?.details?.items?.map(
        (item: any) => item.node?.snippet
      ) || [],
    };
  }

  /**
   * Audit key pages with both mobile and desktop strategies.
   * Rate limited: ~25 req/100 seconds for free tier.
   */
  async auditAllPages(sitemapUrls: string[]): Promise<LighthouseReport[]> {
    const reports: LighthouseReport[] = [];
    for (const url of sitemapUrls) {
      try {
        // Mobile audit
        await new Promise(r => setTimeout(r, 4000));
        reports.push(await this.auditPage(url, 'mobile'));
        // Desktop audit
        await new Promise(r => setTimeout(r, 4000));
        reports.push(await this.auditPage(url, 'desktop'));
      } catch (err: any) {
        console.error(`Failed to audit ${url}:`, err.message);
      }
    }
    return reports;
  }
}
