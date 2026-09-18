import { Injectable } from '@nestjs/common';

@Injectable()
export class SitemapCrawlerService {
  async crawlSitemap(siteUrl: string): Promise<string[]> {
    const response = await fetch(`${siteUrl}/sitemap.xml`);
    const xml = await response.text();
    const urls = xml.match(/<loc>(.*?)<\/loc>/g)
      ?.map(m => m.replace(/<\/?loc>/g, '')) || [];
    return urls;
  }
}
