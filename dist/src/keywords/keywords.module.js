"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordsModule = void 0;
const common_1 = require("@nestjs/common");
const keywords_service_1 = require("./keywords.service");
const keywords_cache_1 = require("./keywords.cache");
const google_ads_client_1 = require("./clients/google-ads.client");
let KeywordsModule = class KeywordsModule {
};
exports.KeywordsModule = KeywordsModule;
exports.KeywordsModule = KeywordsModule = __decorate([
    (0, common_1.Module)({
        providers: [
            keywords_service_1.KeywordsService,
            keywords_cache_1.KeywordsCache,
            google_ads_client_1.GoogleAdsClient,
        ],
        exports: [keywords_service_1.KeywordsService, google_ads_client_1.GoogleAdsClient],
    })
], KeywordsModule);
//# sourceMappingURL=keywords.module.js.map