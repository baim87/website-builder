import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, PlaceInputType } from '@googlemaps/google-maps-services-js';

@Injectable()
export class GbpService {
  private readonly logger = new Logger(GbpService.name);
  private readonly apiKey: string;
  private readonly client: Client;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY') || '';
    this.client = new Client({});
  }

  async lookup(businessName: string, location: string): Promise<any> {
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY not set, bypassing GBP lookup.');
      return null;
    }

    try {
      const query = `${businessName} ${location}`;
      
      // 1. Find Place from Text
      const findRes = await this.client.findPlaceFromText({
        params: {
          input: query,
          inputtype: PlaceInputType.textQuery,
          fields: ['place_id'],
          key: this.apiKey,
        },
      });

      if (!findRes.data.candidates || findRes.data.candidates.length === 0) {
        return null;
      }

      const placeId = findRes.data.candidates[0].place_id;

      if (!placeId) {
        return null;
      }

      // 2. Get Details
      const detailsRes = await this.client.placeDetails({
        params: {
          place_id: placeId,
          fields: ['name', 'formatted_address', 'formatted_phone_number', 'website', 'opening_hours', 'rating', 'user_ratings_total'],
          key: this.apiKey,
        },
      });

      return detailsRes.data.result;
    } catch (error) {
      this.logger.error(`Failed to fetch GBP data for ${businessName} in ${location}`, error);
      return null;
    }
  }
}
