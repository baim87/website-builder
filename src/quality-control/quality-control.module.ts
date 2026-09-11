import { Module, forwardRef } from '@nestjs/common';
import { QualityControlService } from './quality-control.service';
import { SitemapCrawlerService } from './sitemap-crawler.service';
import { LinkIntegrityService } from './link-integrity.service';
import { PageSpeedService } from './pagespeed.service';
import { VisualQAService } from './visual-qa.service';
import { BrowserlessService } from './browserless.service';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QCOrchestratorService } from './qc-orchestrator.service';
import { AutoRepairModule } from '../auto-repair/auto-repair.module';
import { DeploymentModule } from '../deployment/deployment.module';
import { SkillsModule } from '../skills/skills.module';
import { ImageCritiqueService } from './image-critique.service';

@Module({
  imports: [AIGatewayModule, PrismaModule, forwardRef(() => AutoRepairModule), forwardRef(() => DeploymentModule), forwardRef(() => SkillsModule)],
  providers: [
    QualityControlService,
    SitemapCrawlerService,
    LinkIntegrityService,
    PageSpeedService,
    VisualQAService,
    BrowserlessService,
    QCOrchestratorService,
    ImageCritiqueService,
  ],
  exports: [QualityControlService, QCOrchestratorService, ImageCritiqueService],
})
export class QualityControlModule {}
