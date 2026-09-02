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

  async getCitiesInRadius(location: string, radiusMiles: number): Promise<string[]> {
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY is not set. Skipping cities fetch.');
      return [];
    }

    try {
      const radiusMeters = Math.min(radiusMiles * 1609.34, 50000); // 50km max for Places API

      // 1. Get coordinates for the location
      const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'places.location',
        },
        body: JSON.stringify({ textQuery: location }),
      });
      
      const searchData = await searchRes.json();
      if (!searchData.places || searchData.places.length === 0) {
        this.logger.warn(`Location not found for cities fetch: ${location}`);
        return [];
      }
      
      const center = searchData.places[0].location;

      // 2. Search for nearby localities
      const nearbyRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress',
        },
        body: JSON.stringify({
          includedTypes: ['locality'],
          locationRestriction: {
            circle: {
              center,
              radius: radiusMeters
            }
          },
          maxResultCount: 15
        }),
      });

      const nearbyData = await nearbyRes.json();
      if (!nearbyData.places) return [];

      const cities = nearbyData.places
        .map((p: any) => p.displayName?.text)
        .filter((c: string) => !!c);
        
      // Deduplicate
      return Array.from(new Set(cities)) as string[];
    } catch (e: any) {
      this.logger.error(`Failed to fetch cities in radius for ${location}`, e.stack);
      return [];
    }
  }
}
