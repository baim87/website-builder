import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule, ClsService } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import * as crypto from 'crypto';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
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

import { AutoRepairModule } from './auto-repair/auto-repair.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EditorModule } from './editor/editor.module';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true, idGenerator: () => crypto.randomUUID() },
    }),
    LoggerModule.forRootAsync({
      imports: [ClsModule],
      inject: [ClsService],
      useFactory: (cls: ClsService) => {
        return {
          pinoHttp: {
            transport: process.env.NODE_ENV !== 'production' ? {
              target: 'pino-pretty',
              options: { colorize: true, singleLine: true }
            } : undefined,
            level: process.env.LOG_LEVEL || 'info',
            redact: [
              'req.headers.authorization',
              'businessContext',
              'projectAssets',
            ],
            mixin: () => {
              return {
                traceId: cls.get('traceId'),
                userId: cls.get('userId'),
                projectId: cls.get('projectId'),
              };
            },
          },
        };
      },
    }),
    ConfigModule, PrismaModule, AuthModule, ProjectsModule, ChatModule, InterviewModule, GbpModule, GuardrailsModule, SeoModule, GenerationModule, AssetsModule, AIGatewayModule, QueueModule, StorageModule, KeywordsModule, SkillsModule, BillingModule, HealthModule, AnalyticsModule, StripeModule, VercelModule, DeploymentModule, DomainModule, LeadsModule, RedisModule, QualityControlModule, AutoRepairModule, EditorModule, EventEmitterModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [{
        ttl: configService.get<number>('THROTTLE_TTL') || 60000,
        limit: configService.get<number>('THROTTLE_LIMIT') || 100,
      }],
    })],

  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
