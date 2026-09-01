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
var GoogleAuthClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAuthClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const googleapis_1 = require("googleapis");
const error_util_1 = require("../../common/utils/error.util");
let GoogleAuthClient = GoogleAuthClient_1 = class GoogleAuthClient {
    configService;
    logger = new common_1.Logger(GoogleAuthClient_1.name);
    _jwtClient;
    _clientEmail;
    _privateKey;
    constructor(configService) {
        this.configService = configService;
        this.initializeAuth();
    }
    initializeAuth() {
        this._clientEmail = this.configService.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
        this._privateKey = this.configService.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
        if (!this._clientEmail || !this._privateKey) {
            this.logger.warn('Google Service Account credentials missing in environment.');
            return;
        }
        try {
            this._jwtClient = new googleapis_1.google.auth.JWT({
                email: this._clientEmail,
                key: this._privateKey.replace(/\\n/g, '\n'),
                scopes: [
                    'https://www.googleapis.com/auth/analytics.edit',
                    'https://www.googleapis.com/auth/tagmanager.edit.containers',
                    'https://www.googleapis.com/auth/tagmanager.manage.accounts',
                    'https://www.googleapis.com/auth/webmasters',
                ],
            });
        }
        catch (error) {
            this.logger.error(`Failed to initialize Google Auth JWT: ${(0, error_util_1.getErrorMessage)(error)}`);
        }
    }
    get jwtClient() {
        if (!this._jwtClient) {
            throw new Error('Google Auth Client not initialized due to missing credentials');
        }
        return this._jwtClient;
    }
    get clientEmail() {
        return this._clientEmail;
    }
    get privateKey() {
        return this._privateKey;
    }
};
exports.GoogleAuthClient = GoogleAuthClient;
exports.GoogleAuthClient = GoogleAuthClient = GoogleAuthClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GoogleAuthClient);
//# sourceMappingURL=google-auth.client.js.map