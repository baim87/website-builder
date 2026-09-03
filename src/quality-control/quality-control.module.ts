import { Module } from '@nestjs/common';
import { QualityControlService } from './quality-control.service';
import { SitemapCrawlerService } from './sitemap-crawler.service';
import { LinkIntegrityService } from './link-integrity.service';
import { PageSpeedService } from './pagespeed.service';
import { VisualQAService } from './visual-qa.service';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AIGatewayModule, PrismaModule],
  providers: [
    QualityControlService,
    SitemapCrawlerService,
    LinkIntegrityService,
    PageSpeedService,
    VisualQAService,
  ],
  exports: [QualityControlService],
})
export class QualityControlModule {}
