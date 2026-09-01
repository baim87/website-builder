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
var GbpService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GbpService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
let GbpService = GbpService_1 = class GbpService {
    configService;
    logger = new common_1.Logger(GbpService_1.name);
    apiKey;
    client;
    constructor(configService) {
        this.configService = configService;
        this.apiKey = this.configService.get('GOOGLE_PLACES_API_KEY') || '';
        this.client = new google_maps_services_js_1.Client({});
    }
    async lookup(businessName, location) {
        if (!this.apiKey) {
            this.logger.warn('GOOGLE_PLACES_API_KEY not set, bypassing GBP lookup.');
            return null;
        }
        try {
            const query = `${businessName} ${location}`;
            const findRes = await this.client.findPlaceFromText({
                params: {
                    input: query,
                    inputtype: google_maps_services_js_1.PlaceInputType.textQuery,
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
            const detailsRes = await this.client.placeDetails({
                params: {
                    place_id: placeId,
                    fields: ['name', 'formatted_address', 'formatted_phone_number', 'website', 'opening_hours', 'rating', 'user_ratings_total'],
                    key: this.apiKey,
                },
            });
            return detailsRes.data.result;
        }
        catch (error) {
            this.logger.error(`Failed to fetch GBP data for ${businessName} in ${location}`, error);
            return null;
        }
    }
};
exports.GbpService = GbpService;
exports.GbpService = GbpService = GbpService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GbpService);
//# sourceMappingURL=gbp.service.js.map