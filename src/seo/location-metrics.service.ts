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

  async processProjectMetrics(projectId: string, cities: string[], services: string[]) {
    this.logger.log(`Starting background location metrics processing for project ${projectId}. Cities: ${cities.length}`);
    
    // 3. Fetch volumes for each city+service combo
    const metricsToSave = [];

    // TIER 2: Pre-fetch from Global Cache
    const globalCacheResults = await this.prisma.globalKeywordCache.findMany({
      where: {
        city: { in: cities.map(c => c.toLowerCase()) },
        service: { in: services }
      }
    });
    
    const globalCacheMap = new Map();
    for (const res of globalCacheResults) {
      globalCacheMap.set(`${res.service.toLowerCase()}|${res.city.toLowerCase()}`, res);
    }
    
    for (const city of cities) {
      for (const service of services) {
        try {
          const cacheKey = `${service.toLowerCase()}|${city.toLowerCase()}`;
          const cached = globalCacheMap.get(cacheKey);
          
          if (cached) {
            this.logger.debug(`[TIER 2 HIT] Found ${service} in ${city} in GlobalKeywordCache.`);
            metricsToSave.push({
              projectId,
              city,
              service,
              keyword: cached.keyword,
              searchVolume: cached.searchVolume,
              difficulty: cached.competition || 0,
              cpc: cached.cpc || 0,
            });
            continue;
          }

          // Add a delay to respect Google Ads strict quotas
          await new Promise((resolve) => setTimeout(resolve, 1500));
          
          this.logger.debug(`[TIER 3 MISS] Fetching keywords for ${service} in ${city}...`);
          const results = await this.googleAdsClient.fetchKeywords(service, city);
          
          if (results && results.length > 0) {
            // Strict Transactional Filter
            const serviceTokens = service.toLowerCase().split(' ').filter(t => t.length > 2);
            let relevantResults = results.filter(r => {
              const kw = r.keyword.toLowerCase();
              return kw.includes(service.toLowerCase()) || serviceTokens.some(token => kw.includes(token));
            });

            const infoWords = ['how', 'what', 'why', 'cost of', 'diy', 'price', 'vs', 'vs.', 'guide'];
            const brandWords = ['home depot', 'lowes', 'menards', 'buy', 'for sale'];
            const badWords = [...infoWords, ...brandWords];
            
            relevantResults = relevantResults.filter(r => {
              const kw = r.keyword.toLowerCase();
              return !badWords.some(bad => kw.includes(bad) || kw.startsWith(bad));
            });
            
            // Contractor Intent Boost
            const contractorIntent = ['contractor', 'contractors', 'company', 'companies', 'builder', 'builders', 'installer', 'installation', 'services', 'repair', 'near me', city.toLowerCase().split(',')[0]];
            
            // Score and sort
            relevantResults.sort((a, b) => {
              const aKw = a.keyword.toLowerCase();
              const bKw = b.keyword.toLowerCase();
              const aBoost = contractorIntent.some(i => aKw.includes(i)) ? 2 : 1;
              const bBoost = contractorIntent.some(i => bKw.includes(i)) ? 2 : 1;
              return (b.searchVolume * bBoost) - (a.searchVolume * aBoost);
            });

            if (relevantResults.length > 0) {
              const topResult = relevantResults[0];
              
              metricsToSave.push({
                projectId,
                city,
                service,
                keyword: topResult.keyword,
                searchVolume: topResult.searchVolume,
                difficulty: topResult.competition || 0,
                cpc: topResult.cpc || 0,
              });

              // Save to Global Cache for future projects
              await this.prisma.globalKeywordCache.create({
                data: {
                  city: city.toLowerCase(),
                  state: city.includes(',') ? city.split(',')[1].trim().toUpperCase() : null,
                  trade: 'Local Service',
                  service,
                  keyword: topResult.keyword,
                  searchVolume: topResult.searchVolume,
                  competition: topResult.competition,
                  cpc: topResult.cpc,
                  monthlyVolumes: (topResult.monthlySearchVolumes as any) || [],
                  geoScope: 'local'
                }
              }).catch(() => {}); // Ignore unique constraint collisions
            }
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
      cities.add(baseLocation);

      if (textRes.data.results) {
        for (const place of textRes.data.results) {
           if (place.name && !place.name.toLowerCase().includes('county')) {
             // Ensure it is actually a city/town and not a building or point of interest
             if (place.types && (place.types.includes('locality' as any) || place.types.includes('administrative_area_level_3' as any))) {
               // Calculate actual distance to enforce strict radius since Google Maps bias is soft
               if (place.geometry && place.geometry.location) {
                 const distanceMeters = this.calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng);
                 if (distanceMeters <= radiusMeters) {
                   let cityName = place.name;
                   if (place.formatted_address) {
                     const parts = place.formatted_address.split(',');
                     if (parts.length >= 2) {
                       const statePart = parts[1].trim().split(' ')[0];
                       if (statePart.length === 2 && statePart === statePart.toUpperCase()) {
                         cityName = `${place.name}, ${statePart}`;
                       }
                     }
                   }
                   cities.add(cityName);
                 }
               }
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

  // Haversine distance formula in meters
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in metres
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
