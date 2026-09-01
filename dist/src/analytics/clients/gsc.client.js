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
var GscClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GscClient = void 0;
const common_1 = require("@nestjs/common");
const googleapis_1 = require("googleapis");
const google_auth_client_1 = require("./google-auth.client");
let GscClient = GscClient_1 = class GscClient {
    authClient;
    logger = new common_1.Logger(GscClient_1.name);
    gscApi;
    constructor(authClient) {
        this.authClient = authClient;
        try {
            this.gscApi = googleapis_1.google.webmasters({ version: 'v3', auth: this.authClient.jwtClient });
        }
        catch (e) {
            this.logger.warn('GSC Client not initialized (missing auth credentials)');
        }
    }
    async verifySite(domainName) {
        const siteUrl = `https://${domainName}`;
        this.logger.log(`Adding ${siteUrl} to Search Console`);
        if (!this.gscApi) {
            throw new Error('GSC API client not initialized');
        }
        await this.gscApi.sites.add({
            siteUrl,
        });
    }
};
exports.GscClient = GscClient;
exports.GscClient = GscClient = GscClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [google_auth_client_1.GoogleAuthClient])
], GscClient);
//# sourceMappingURL=gsc.client.js.map