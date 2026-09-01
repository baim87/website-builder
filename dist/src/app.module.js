"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const config_module_1 = require("./config/config.module");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const tenant_middleware_1 = require("./common/middleware/tenant.middleware");
const ai_gateway_module_1 = require("./ai-gateway/ai-gateway.module");
const queue_module_1 = require("./queue/queue.module");
const storage_module_1 = require("./storage/storage.module");
const keywords_module_1 = require("./keywords/keywords.module");
const skills_module_1 = require("./skills/skills.module");
const billing_module_1 = require("./billing/billing.module");
const health_module_1 = require("./health/health.module");
const projects_module_1 = require("./projects/projects.module");
const chat_module_1 = require("./chat/chat.module");
const interview_module_1 = require("./interview/interview.module");
const gbp_module_1 = require("./gbp/gbp.module");
const guardrails_module_1 = require("./guardrails/guardrails.module");
const seo_module_1 = require("./seo/seo.module");
const generation_module_1 = require("./generation/generation.module");
const assets_module_1 = require("./assets/assets.module");
const analytics_module_1 = require("./analytics/analytics.module");
const stripe_module_1 = require("./stripe/stripe.module");
const vercel_module_1 = require("./vercel/vercel.module");
const deployment_module_1 = require("./deployment/deployment.module");
const domain_module_1 = require("./domain/domain.module");
const leads_module_1 = require("./leads/leads.module");
const redis_module_1 = require("./common/redis/redis.module");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(tenant_middleware_1.TenantMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [config_module_1.ConfigModule, prisma_module_1.PrismaModule, auth_module_1.AuthModule, projects_module_1.ProjectsModule, chat_module_1.ChatModule, interview_module_1.InterviewModule, gbp_module_1.GbpModule, guardrails_module_1.GuardrailsModule, seo_module_1.SeoModule, generation_module_1.GenerationModule, assets_module_1.AssetsModule, ai_gateway_module_1.AIGatewayModule, queue_module_1.QueueModule, storage_module_1.StorageModule, keywords_module_1.KeywordsModule, skills_module_1.SkillsModule, billing_module_1.BillingModule, health_module_1.HealthModule, analytics_module_1.AnalyticsModule, stripe_module_1.StripeModule, vercel_module_1.VercelModule, deployment_module_1.DeploymentModule, domain_module_1.DomainModule, leads_module_1.LeadsModule, redis_module_1.RedisModule],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map