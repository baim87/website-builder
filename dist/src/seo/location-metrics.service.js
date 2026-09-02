"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LocationMetricsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationMetricsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
const google_ads_client_1 = require("../keywords/clients/google-ads.client");
const prisma_service_1 = require("../prisma/prisma.service");
let LocationMetricsService = LocationMetricsService_1 = class LocationMetricsService {
    configService;
    googleAdsClient;
    prisma;
    logger = new common_1.Logger(LocationMetricsService_1.name);
    mapsClient;
    apiKey;
    constructor(configService, googleAdsClient, prisma) {
        this.configService = configService;
        this.googleAdsClient = googleAdsClient;
        this.prisma = prisma;
        this.apiKey = this.configService.get('GOOGLE_PLACES_API_KEY') || '';
        this.mapsClient = new google_maps_services_js_1.Client({});
    }
    async processProjectMetrics(projectId, baseLocation, radiusMiles, services) {
        this.logger.log(`Starting background location metrics processing for project ${projectId}. Base: ${baseLocation}, Radius: ${radiusMiles}`);
        const cities = await this.getCitiesInRadius(baseLocation, radiusMiles);
        this.logger.log(`Found ${cities.length} cities within ${radiusMiles} miles of ${baseLocation}.`);
        const metricsToSave = [];
        for (const city of cities) {
            for (const service of services) {
                try {
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                    this.logger.debug(`Fetching keywords for ${service} in ${city}...`);
                    const results = await this.googleAdsClient.fetchKeywords(service, city);
                    if (results && results.length > 0) {
                        const topResult = results.sort((a, b) => b.searchVolume - a.searchVolume)[0];
                        metricsToSave.push({
                            projectId,
                            city,
                            service,
                            keyword: topResult.keyword,
                            searchVolume: topResult.searchVolume,
                            difficulty: 0,
                            cpc: 0,
                        });
                    }
                }
                catch (error) {
                    this.logger.warn(`Failed to fetch keyword volume for ${service} in ${city}: ${error.message}`);
                }
            }
        }
        if (metricsToSave.length > 0) {
            await this.saveMetrics(metricsToSave);
            this.logger.log(`Successfully saved ${metricsToSave.length} keyword metrics for project ${projectId}.`);
        }
    }
    async getCitiesInRadius(baseLocation, radiusMiles) {
        if (!this.apiKey)
            return [baseLocation];
        try {
            const geoRes = await this.mapsClient.geocode({
                params: { address: baseLocation, key: this.apiKey }
            });
            if (!geoRes.data.results || geoRes.data.results.length === 0) {
                return [baseLocation];
            }
            const { lat, lng } = geoRes.data.results[0].geometry.location;
            const radiusMeters = radiusMiles * 1609.34;
            const textRes = await this.mapsClient.textSearch({
                params: {
                    query: 'city OR town',
                    location: { lat, lng },
                    radius: radiusMeters,
                    key: this.apiKey,
                }
            });
            const cities = new Set();
            const baseCity = baseLocation.split(',')[0].trim();
            cities.add(baseCity);
            if (textRes.data.results) {
                for (const place of textRes.data.results) {
                    if (place.name && !place.name.toLowerCase().includes('county')) {
                        cities.add(place.name);
                    }
                }
            }
            return Array.from(cities).slice(0, 10);
        }
        catch (e) {
            this.logger.error('Failed to get cities in radius', e.message);
            return [baseLocation];
        }
    }
    async saveMetrics(metrics) {
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
};
exports.LocationMetricsService = LocationMetricsService;
exports.LocationMetricsService = LocationMetricsService = LocationMetricsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        google_ads_client_1.GoogleAdsClient,
        prisma_service_1.PrismaService])
], LocationMetricsService);
//# sourceMappingURL=location-metrics.service.js.map