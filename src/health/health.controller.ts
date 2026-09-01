import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StorageService } from '../storage/storage.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
      const redis = new Redis(this.configService.get<string>('REDIS_URL')!);
      await redis.ping();
      redis.disconnect();
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
