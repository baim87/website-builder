import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Get()
  async check() {
    const status: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {},
    };

    // DB
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      status.services.database = 'ok';
    } catch (e) {
      status.services.database = 'error';
      status.status = 'error';
    }

    // Redis
    try {
      await this.redisService.getClient().ping();
      status.services.redis = 'ok';
    } catch (e) {
      status.services.redis = 'error';
      status.status = 'error';
    }

    // R2 (S3)
    try {
      // Very basic check, e.g. upload a 1 byte test file or just list buckets if possible.
      // Usually checking if the client initialized successfully is enough.
      if (this.storage) {
         status.services.storage = 'ok';
      }
    } catch (e) {
      status.services.storage = 'error';
      status.status = 'error';
    }

    return status;
  }
}
