import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY') || '';
  }

  async scrapeGoogleBusinessProfile(queryOrUrl: string) {
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY is not set. Skipping GBP scrape.');
      return null;
    }

    try {
      // 1. Text Search to find the Place
      // If the user pastes a URL, it might contain the business name, or we can just pass the URL string as a text search query, which often works.
      const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
      const searchBody = {
        textQuery: queryOrUrl,
      };

      const searchResponse = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          // We want these specific fields returned
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.regularOpeningHours,places.types',
        },
        body: JSON.stringify(searchBody),
      });

      if (!searchResponse.ok) {
        throw new Error(`Google Places API error: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      const places = searchData.places || [];
      if (places.length === 0) {
        this.logger.warn(`No place found for query: ${queryOrUrl}`);
        return [];
      }

      // 2. Map Place details to our internal schema
      return places.map((place: any) => ({
        businessName: place.displayName?.text,
        businessAddress: place.formattedAddress,
        phone: place.nationalPhoneNumber,
        gbpData: { website: place.websiteUri },
        trade: place.types ? place.types.join(', ') : undefined,
        hours: place.regularOpeningHours?.weekdayDescriptions,
      }));
    } catch (error: any) {
      this.logger.error(`Failed to scrape GBP for query: ${queryOrUrl}`, error.stack);
      return null;
    }
  }
}
