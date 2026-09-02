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
var GooglePlacesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GooglePlacesService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let GooglePlacesService = GooglePlacesService_1 = class GooglePlacesService {
    configService;
    logger = new common_1.Logger(GooglePlacesService_1.name);
    apiKey;
    constructor(configService) {
        this.configService = configService;
        this.apiKey = this.configService.get('GOOGLE_PLACES_API_KEY') || '';
    }
    async scrapeGoogleBusinessProfile(queryOrUrl) {
        if (!this.apiKey) {
            this.logger.warn('GOOGLE_PLACES_API_KEY is not set. Skipping GBP scrape.');
            return null;
        }
        try {
            const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
            const searchBody = {
                textQuery: queryOrUrl,
            };
            const searchResponse = await fetch(searchUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
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
            return places.map((place) => ({
                businessName: place.displayName?.text,
                businessAddress: place.formattedAddress,
                phone: place.nationalPhoneNumber,
                gbpData: { website: place.websiteUri },
                trade: place.types ? place.types.join(', ') : undefined,
                hours: place.regularOpeningHours?.weekdayDescriptions,
            }));
        }
        catch (error) {
            this.logger.error(`Failed to scrape GBP for query: ${queryOrUrl}`, error.stack);
            return null;
        }
    }
    async getCitiesInRadius(location, radiusMiles) {
        if (!this.apiKey) {
            this.logger.warn('GOOGLE_PLACES_API_KEY is not set. Skipping cities fetch.');
            return [];
        }
        try {
            const radiusMeters = Math.min(radiusMiles * 1609.34, 50000);
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
            if (!nearbyData.places)
                return [];
            const cities = nearbyData.places
                .map((p) => p.displayName?.text)
                .filter((c) => !!c);
            return Array.from(new Set(cities));
        }
        catch (e) {
            this.logger.error(`Failed to fetch cities in radius for ${location}`, e.stack);
            return [];
        }
    }
};
exports.GooglePlacesService = GooglePlacesService;
exports.GooglePlacesService = GooglePlacesService = GooglePlacesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GooglePlacesService);
//# sourceMappingURL=google-places.service.js.map