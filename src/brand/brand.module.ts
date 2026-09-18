import { Module } from '@nestjs/common';
import { BrandKnowledgeService } from './brand-knowledge.service';
import { StorageModule } from '../storage/storage.module';
import { AssetsModule } from '../assets/assets.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [StorageModule, AssetsModule, PrismaModule],
  providers: [BrandKnowledgeService],
  exports: [BrandKnowledgeService]
})
export class BrandModule {}
