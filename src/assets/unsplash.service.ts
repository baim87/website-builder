import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class UnsplashService {
  private readonly logger = new Logger(UnsplashService.name);
  private readonly accessKey = process.env.UNSPLASH_ACCESS_KEY;
  private readonly cache = new Map<string, string>();

  private cleanQuery(query: string): string {
    // Remove fluff words to get better Unsplash results
    return query
      .replace(/home/i, '')
      .replace(/best/i, '')
      .replace(/quality/i, '')
      .replace(/professional/i, '')
      .replace(/services?/i, '')
      .replace(/near me/i, '')
      .replace(/company/i, '')
      .replace(/contractor/i, '')
      .trim();
  }

  async searchImage(originalQuery: string): Promise<string> {
    const fallbackQuery = originalQuery.split(' ')[0] || 'construction';
    const fallbackUrl = `https://loremflickr.com/1600/900/${encodeURIComponent(fallbackQuery)}`;

    if (!this.accessKey) {
      this.logger.warn('UNSPLASH_ACCESS_KEY is missing. Returning placeholder.');
      return fallbackUrl;
    }

    if (this.cache.has(originalQuery)) {
      this.logger.debug(`Cache hit for query: "${originalQuery}"`);
      return this.cache.get(originalQuery)!;
    }

    const queriesToTry = [
      originalQuery,
      this.cleanQuery(originalQuery),
      originalQuery.split(' ').slice(0, 2).join(' '), // First two words
      originalQuery.split(' ')[0] // Just the first word
    ].filter(q => q.length > 2); // Filter out tiny or empty queries

    // Remove duplicates
    const uniqueQueries = [...new Set(queriesToTry)];

    for (const query of uniqueQueries) {
      try {
        this.logger.debug(`Fetching Unsplash image for query: "${query}"`);
        const response = await axios.get('https://api.unsplash.com/search/photos', {
          params: {
            query,
            per_page: 1,
            orientation: 'landscape'
          },
          headers: {
            Authorization: `Client-ID ${this.accessKey}`
          }
        });

        const results = response.data.results;
        if (results && results.length > 0) {
          const url = results[0].urls.regular;
          this.cache.set(originalQuery, url);
          return url;
        }
      } catch (error: any) {
        // If rate limited (403), stop trying and fallback immediately
        if (error.response?.status === 403) {
          this.logger.error('Unsplash API rate limit reached (403). Using fallback.');
          break;
        }
        this.logger.warn(`Failed to fetch image for query "${query}": ${error.message}`);
      }
    }

    this.logger.warn(`No images found for original query: "${originalQuery}". Using fallback.`);
    this.cache.set(originalQuery, fallbackUrl);
    return fallbackUrl;
  }
}
