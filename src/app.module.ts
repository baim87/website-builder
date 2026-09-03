import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { AIGatewayModule } from './ai-gateway/ai-gateway.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { KeywordsModule } from './keywords/keywords.module';
import { SkillsModule } from './skills/skills.module';
import { BillingModule } from './billing/billing.module';
import { HealthModule } from './health/health.module';
import { ProjectsModule } from './projects/projects.module';
import { ChatModule } from './chat/chat.module';
import { InterviewModule } from './interview/interview.module';
import { GbpModule } from './gbp/gbp.module';
import { GuardrailsModule } from './guardrails/guardrails.module';
import { SeoModule } from './seo/seo.module';
import { GenerationModule } from './generation/generation.module';
import { AssetsModule } from './assets/assets.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { StripeModule } from './stripe/stripe.module';
import { VercelModule } from './vercel/vercel.module';
import { DeploymentModule } from './deployment/deployment.module';
import { DomainModule } from './domain/domain.module';
import { LeadsModule } from './leads/leads.module';
import { RedisModule } from './common/redis/redis.module';

import { QualityControlModule } from './quality-control/quality-control.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, ProjectsModule, ChatModule, InterviewModule, GbpModule, GuardrailsModule, SeoModule, GenerationModule, AssetsModule, AIGatewayModule, QueueModule, StorageModule, KeywordsModule, SkillsModule, BillingModule, HealthModule, AnalyticsModule, StripeModule, VercelModule, DeploymentModule, DomainModule, LeadsModule, RedisModule, QualityControlModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
