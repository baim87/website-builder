import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@googlemaps/google-maps-services-js';
import { GoogleAdsClient } from '../keywords/clients/google-ads.client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationMetricsService {
  private readonly logger = new Logger(LocationMetricsService.name);
  private readonly mapsClient: Client;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly googleAdsClient: GoogleAdsClient,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY') || '';
    this.mapsClient = new Client({});
  }

  async processProjectMetrics(projectId: string, baseLocation: string, radiusMiles: number, services: string[]) {
    this.logger.log(`Starting background location metrics processing for project ${projectId}. Base: ${baseLocation}, Radius: ${radiusMiles}`);
    
    // 1. Get cities in radius
    const cities = await this.getCitiesInRadius(baseLocation, radiusMiles);
    this.logger.log(`Found ${cities.length} cities within ${radiusMiles} miles of ${baseLocation}.`);

    // 2. Fetch volumes for each city+service combo
    const metricsToSave = [];
    
    for (const city of cities) {
      for (const service of services) {
        try {
          // Add a delay to respect Google Ads strict quotas
          await new Promise((resolve) => setTimeout(resolve, 1500));
          
          this.logger.debug(`Fetching keywords for ${service} in ${city}...`);
          const results = await this.googleAdsClient.fetchKeywords(service, city);
          
          // Find the highest volume relevant keyword
          if (results && results.length > 0) {
            // Sort by search volume descending
            const topResult = results.sort((a, b) => b.searchVolume - a.searchVolume)[0];
            
            metricsToSave.push({
              projectId,
              city,
              service,
              keyword: topResult.keyword,
              searchVolume: topResult.searchVolume,
              difficulty: 0, // Mock for now if Google Ads doesn't provide it
              cpc: 0,
            });
          }
        } catch (error: any) {
           this.logger.warn(`Failed to fetch keyword volume for ${service} in ${city}: ${error.message}`);
        }
      }
    }
    
    // 3. Save to DB
    if (metricsToSave.length > 0) {
      await this.saveMetrics(metricsToSave);
      this.logger.log(`Successfully saved ${metricsToSave.length} keyword metrics for project ${projectId}.`);
    }
  }

  private async getCitiesInRadius(baseLocation: string, radiusMiles: number): Promise<string[]> {
    if (!this.apiKey) return [baseLocation];

    try {
      // Geocode the base location
      const geoRes = await this.mapsClient.geocode({
        params: { address: baseLocation, key: this.apiKey }
      });
      
      if (!geoRes.data.results || geoRes.data.results.length === 0) {
        return [baseLocation];
      }
      
      const { lat, lng } = geoRes.data.results[0].geometry.location;
      const radiusMeters = radiusMiles * 1609.34; // convert miles to meters

      // Search for localities around this point
      const textRes = await this.mapsClient.textSearch({
        params: {
          query: `towns and cities near ${baseLocation}`,
          location: { lat, lng },
          radius: radiusMeters,
          key: this.apiKey,
        }
      });

      const cities = new Set<string>();
      // Always include the base city explicitly
      const baseCity = baseLocation.split(',')[0].trim();
      cities.add(baseCity);

      if (textRes.data.results) {
        for (const place of textRes.data.results) {
           if (place.name && !place.name.toLowerCase().includes('county')) {
             // Ensure it is actually a city/town and not a building or point of interest
             if (place.types && (place.types.includes('locality' as any) || place.types.includes('administrative_area_level_3' as any))) {
               cities.add(place.name);
             }
           }
        }
      }

      // Limit to 10 cities max to avoid blowing up API limits during onboarding
      return Array.from(cities).slice(0, 10);
    } catch (e: any) {
       this.logger.error('Failed to get cities in radius', e.message);
       return [baseLocation];
    }
  }

  private async saveMetrics(metrics: any[]) {
    for (const metric of metrics) {
      await this.prisma.locationKeywordMetrics.upsert({
        where: {
          projectId_city_service: {
            projectId: metric.projectId,
            city: metric.city,
            service: metric.service,
          }
        },
        update: {
          keyword: metric.keyword,
          searchVolume: metric.searchVolume,
          difficulty: metric.difficulty,
          cpc: metric.cpc,
        },
        create: {
          projectId: metric.projectId,
          city: metric.city,
          service: metric.service,
          keyword: metric.keyword,
          searchVolume: metric.searchVolume,
          difficulty: metric.difficulty,
          cpc: metric.cpc,
        }
      });
    }
  }
}
