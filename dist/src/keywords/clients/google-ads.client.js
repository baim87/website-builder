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
var GoogleAdsClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAdsClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const google_ads_api_1 = require("google-ads-api");
let GoogleAdsClient = GoogleAdsClient_1 = class GoogleAdsClient {
    configService;
    logger = new common_1.Logger(GoogleAdsClient_1.name);
    client = null;
    constructor(configService) {
        this.configService = configService;
        const clientId = this.configService.get('GOOGLE_ADS_CLIENT_ID');
        const clientSecret = this.configService.get('GOOGLE_ADS_CLIENT_SECRET');
        const developerToken = this.configService.get('GOOGLE_ADS_DEVELOPER_TOKEN');
        if (clientId && clientSecret && developerToken) {
            this.client = new google_ads_api_1.GoogleAdsApi({
                client_id: clientId,
                client_secret: clientSecret,
                developer_token: developerToken,
            });
        }
        else {
            this.logger.warn('Google Ads credentials not found in environment. Keyword generation will fail if invoked.');
        }
    }
    async fetchKeywords(trade, location) {
        this.logger.log(`Fetching keywords from Google Ads for ${trade} in ${location}`);
        if (!this.client) {
            throw new Error('Google Ads API client is not initialized due to missing credentials.');
        }
        const customerId = this.configService.get('GOOGLE_ADS_CUSTOMER_ID');
        const refreshToken = this.configService.get('GOOGLE_ADS_REFRESH_TOKEN');
        if (!customerId || !refreshToken) {
            throw new Error('Google Ads CUSTOMER_ID or REFRESH_TOKEN is missing from environment.');
        }
        const customer = this.client.Customer({
            customer_id: customerId,
            refresh_token: refreshToken,
        });
        try {
            const request = {
                customer_id: customerId,
                keyword_seed: {
                    keywords: [`${trade} ${location}`, `${location} ${trade}`, trade],
                },
                page_size: 15,
            };
            const response = await customer.keywordPlanIdeas.generateKeywordIdeas(request);
            const results = response.results || [];
            return results.map((idea) => ({
                keyword: idea.text || '',
                searchVolume: idea.keyword_idea_metrics?.avg_monthly_searches ? Number(idea.keyword_idea_metrics.avg_monthly_searches) : 0,
                source: 'google',
            }));
        }
        catch (error) {
            this.logger.error('Failed to generate keyword ideas', error.stack);
            throw error;
        }
    }
};
exports.GoogleAdsClient = GoogleAdsClient;
exports.GoogleAdsClient = GoogleAdsClient = GoogleAdsClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GoogleAdsClient);
//# sourceMappingURL=google-ads.client.js.map