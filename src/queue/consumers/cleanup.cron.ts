import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CleanupCronService implements OnModuleInit {
  private readonly logger = new Logger(CleanupCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log('Registering hourly cleanup interval...');
    // Run every 1 hour
    setInterval(() => {
      this.handleCleanup();
    }, 60 * 60 * 1000);
  }

  async handleCleanup() {
    this.logger.log('Starting hourly cleanup tasks...');
    await this.cleanupTempDirectories();
    await this.cleanupSkillInvocations();
  }

  private async cleanupTempDirectories() {
    const tempPath = '/tmp';
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
    
    try {
      const files = await fs.readdir(tempPath);
      let deletedCount = 0;

      for (const file of files) {
        if (file.startsWith('builder-')) {
          const fullPath = path.join(tempPath, file);
          const stats = await fs.stat(fullPath);
          
          if (stats.mtimeMs < fourHoursAgo) {
            await fs.rm(fullPath, { recursive: true, force: true }).catch(() => {});
            deletedCount++;
          }
        }
      }

      this.logger.log(`Cleaned up ${deletedCount} orphaned builder temp directories.`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp directories: ${error.message}`);
    }
  }

  private async cleanupSkillInvocations() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.prisma.skillInvocation.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(`Purged ${result.count} old SkillInvocation records.`);
    } catch (error) {
      this.logger.warn(`Failed to purge old SkillInvocations: ${error.message}`);
    }
  }
}
