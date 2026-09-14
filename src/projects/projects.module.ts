import { Module, forwardRef } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PublicProjectsController } from './public-projects.controller';
import { BusinessContextService } from './business-context.service';
import { WebsiteDataService } from './website-data.service';
import { PageService } from './page.service';
import { GooglePlacesService } from './google-places.service';
import { PublicProjectsService } from './public-projects.service';
import { RevalidationService } from './revalidation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { SeoModule } from '../seo/seo.module';
import { StorageModule } from '../storage/storage.module';
import { BrandModule } from '../brand/brand.module';

@Module({
  imports: [PrismaModule, forwardRef(() => QueueModule), SeoModule, StorageModule, BrandModule],
  controllers: [ProjectsController, PublicProjectsController],
  providers: [ProjectsService, BusinessContextService, WebsiteDataService, PageService, GooglePlacesService, PublicProjectsService, RevalidationService],
  exports: [ProjectsService, BusinessContextService, WebsiteDataService, PageService, GooglePlacesService, PublicProjectsService, RevalidationService],
})
export class ProjectsModule {}
