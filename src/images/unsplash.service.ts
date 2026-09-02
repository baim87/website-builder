import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class UnsplashService {
  private readonly logger = new Logger(UnsplashService.name);
  private readonly accessKey = process.env.UNSPLASH_ACCESS_KEY;

  async searchImage(query: string): Promise<string | null> {
    if (!this.accessKey) {
      this.logger.warn('UNSPLASH_ACCESS_KEY is missing. Returning placeholder.');
      return `https://loremflickr.com/1600/900/${encodeURIComponent(query)}`;
    }

    try {
      this.logger.debug(`Fetching image for query: "${query}"`);
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
        return results[0].urls.regular;
      }
      
      this.logger.warn(`No images found for query: "${query}". Using fallback.`);
      return `https://loremflickr.com/1600/900/${encodeURIComponent(query)}`;
    } catch (error) {
      this.logger.error(`Failed to fetch image from Unsplash for query "${query}": ${error.message}`);
      return `https://loremflickr.com/1600/900/${encodeURIComponent(query)}`;
    }
  }
}
