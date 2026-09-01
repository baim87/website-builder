"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsModule = void 0;
const common_1 = require("@nestjs/common");
const analytics_service_1 = require("./analytics.service");
const analytics_controller_1 = require("./analytics.controller");
const google_auth_client_1 = require("./clients/google-auth.client");
const ga4_client_1 = require("./clients/ga4.client");
const gtm_client_1 = require("./clients/gtm.client");
const gsc_client_1 = require("./clients/gsc.client");
const queue_module_1 = require("../queue/queue.module");
let AnalyticsModule = class AnalyticsModule {
};
exports.AnalyticsModule = AnalyticsModule;
exports.AnalyticsModule = AnalyticsModule = __decorate([
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => queue_module_1.QueueModule)],
        controllers: [analytics_controller_1.AnalyticsController],
        providers: [
            google_auth_client_1.GoogleAuthClient,
            ga4_client_1.Ga4Client,
            gtm_client_1.GtmClient,
            gsc_client_1.GscClient,
            analytics_service_1.AnalyticsService
        ],
        exports: [analytics_service_1.AnalyticsService],
    })
], AnalyticsModule);
//# sourceMappingURL=analytics.module.js.map