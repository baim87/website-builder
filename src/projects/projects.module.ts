import { Module, forwardRef } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { BusinessContextService } from './business-context.service';
import { WebsiteDataService } from './website-data.service';
import { PageService } from './page.service';
import { GooglePlacesService } from './google-places.service';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, forwardRef(() => QueueModule)],
  controllers: [ProjectsController],
  providers: [ProjectsService, BusinessContextService, WebsiteDataService, PageService, GooglePlacesService],
  exports: [ProjectsService, BusinessContextService, WebsiteDataService, PageService, GooglePlacesService],
})
export class ProjectsModule {}
