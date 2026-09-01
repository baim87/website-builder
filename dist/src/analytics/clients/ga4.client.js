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
var Ga4Client_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ga4Client = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const admin_1 = require("@google-analytics/admin");
const google_auth_client_1 = require("./google-auth.client");
let Ga4Client = Ga4Client_1 = class Ga4Client {
    configService;
    authClient;
    logger = new common_1.Logger(Ga4Client_1.name);
    gaAdminClient;
    constructor(configService, authClient) {
        this.configService = configService;
        this.authClient = authClient;
        try {
            this.gaAdminClient = new admin_1.AnalyticsAdminServiceClient({
                credentials: {
                    client_email: this.authClient.clientEmail,
                    private_key: this.authClient.privateKey?.replace(/\\n/g, '\n'),
                },
            });
        }
        catch (e) {
            this.logger.warn('GA4 Admin Client not initialized (missing auth credentials)');
        }
    }
    async createPropertyAndStream(domainName) {
        const accountId = this.configService.get('GOOGLE_ANALYTICS_ACCOUNT_ID');
        if (!accountId)
            throw new Error('Missing GA4 Account ID in env');
        if (!this.gaAdminClient)
            throw new Error('GA4 Admin client not initialized');
        this.logger.log(`Creating GA4 Property for ${domainName}`);
        const [property] = await this.gaAdminClient.createProperty({
            property: {
                parent: `accounts/${accountId}`,
                displayName: `Local Empire - ${domainName}`,
                timeZone: 'America/New_York',
                currencyCode: 'USD',
            },
        });
        const [dataStream] = await this.gaAdminClient.createDataStream({
            parent: property.name,
            dataStream: {
                type: 'WEB_DATA_STREAM',
                displayName: `${domainName} Web Stream`,
                webStreamData: {
                    defaultUri: `https://${domainName}`,
                },
            },
        });
        const propertyId = property.name?.split('/')[1] || '';
        const measurementId = dataStream.webStreamData?.measurementId || '';
        return { propertyId, measurementId };
    }
};
exports.Ga4Client = Ga4Client;
exports.Ga4Client = Ga4Client = Ga4Client_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        google_auth_client_1.GoogleAuthClient])
], Ga4Client);
//# sourceMappingURL=ga4.client.js.map