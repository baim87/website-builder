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
var AnalyticsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ga4_client_1 = require("./clients/ga4.client");
const gtm_client_1 = require("./clients/gtm.client");
const gsc_client_1 = require("./clients/gsc.client");
const error_util_1 = require("../common/utils/error.util");
let AnalyticsService = AnalyticsService_1 = class AnalyticsService {
    prisma;
    ga4Client;
    gtmClient;
    gscClient;
    logger = new common_1.Logger(AnalyticsService_1.name);
    constructor(prisma, ga4Client, gtmClient, gscClient) {
        this.prisma = prisma;
        this.ga4Client = ga4Client;
        this.gtmClient = gtmClient;
        this.gscClient = gscClient;
    }
    async provisionAnalytics(projectId, domainName) {
        this.logger.log(`Processing analytics provision job for project ${projectId} on domain ${domainName}`);
        const existing = await this.prisma.siteAnalytics.findUnique({ where: { projectId } });
        if (existing && existing.gscVerificationStatus === 'VERIFIED') {
            this.logger.log(`Analytics already fully provisioned for ${projectId}`);
            return existing;
        }
        try {
            let propertyId = existing?.ga4PropertyId;
            let measurementId = existing?.ga4MeasurementId;
            let gtmContainerId = existing?.gtmContainerId;
            if (!gtmContainerId) {
                gtmContainerId = await this.gtmClient.createContainer(domainName);
            }
            if (!propertyId || !measurementId) {
                const ga4 = await this.ga4Client.createPropertyAndStream(domainName);
                propertyId = ga4.propertyId;
                measurementId = ga4.measurementId;
            }
            let gscStatus = 'PENDING';
            try {
                await this.gscClient.verifySite(domainName);
                gscStatus = 'VERIFIED';
            }
            catch (e) {
                this.logger.warn(`GSC Provisioning delayed for ${domainName} (DNS likely not propagated). Will retry via BullMQ. Error: ${(0, error_util_1.getErrorMessage)(e)}`);
                throw new Error(`GSC Verification failed: ${(0, error_util_1.getErrorMessage)(e)}`);
            }
            const analyticsRecord = await this.prisma.siteAnalytics.upsert({
                where: { projectId },
                create: {
                    projectId,
                    ga4PropertyId: propertyId,
                    ga4MeasurementId: measurementId,
                    gtmContainerId: gtmContainerId,
                    gscSiteUrl: `https://${domainName}`,
                    gscVerificationStatus: gscStatus,
                },
                update: {
                    ga4PropertyId: propertyId,
                    ga4MeasurementId: measurementId,
                    gtmContainerId: gtmContainerId,
                    gscSiteUrl: `https://${domainName}`,
                    gscVerificationStatus: gscStatus,
                }
            });
            this.logger.log(`Successfully provisioned all analytics for ${projectId}`);
            return analyticsRecord;
        }
        catch (error) {
            this.logger.error(`Analytics provisioning job failed: ${(0, error_util_1.getErrorMessage)(error)}`);
            throw error;
        }
    }
    async getAnalyticsSummary(projectId, userId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId, userId },
        });
        if (!project)
            throw new common_1.HttpException('Project not found', common_1.HttpStatus.NOT_FOUND);
        const analytics = await this.prisma.siteAnalytics.findUnique({
            where: { projectId },
        });
        if (!analytics) {
            return { status: 'NOT_PROVISIONED' };
        }
        return {
            status: 'ACTIVE',
            gtmContainerId: analytics.gtmContainerId,
            ga4MeasurementId: analytics.ga4MeasurementId,
            gscStatus: analytics.gscVerificationStatus,
            trafficSummary: {
                visitors30d: 0,
                pageViews30d: 0,
            }
        };
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = AnalyticsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ga4_client_1.Ga4Client,
        gtm_client_1.GtmClient,
        gsc_client_1.GscClient])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map