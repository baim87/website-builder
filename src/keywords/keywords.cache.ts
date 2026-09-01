import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { KeywordResult } from './interfaces/keyword-data.interface';

@Injectable()
export class KeywordsCache {
  private readonly redis: Redis;
  private readonly logger = new Logger(KeywordsCache.name);
  private readonly TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis(this.configService.get<string>('REDIS_URL')!);
  }

  private getKey(trade: string, location: string): string {
    return `keywords:${trade.toLowerCase()}:${location.toLowerCase()}`;
  }

  async get(trade: string, location: string): Promise<KeywordResult[] | null> {
    const key = this.getKey(trade, location);
    const data = await this.redis.get(key);
    if (data) {
      this.logger.log(`Cache hit for ${key}`);
      return JSON.parse(data) as KeywordResult[];
    }
    return null;
  }

  async set(trade: string, location: string, results: KeywordResult[]): Promise<void> {
    const key = this.getKey(trade, location);
    await this.redis.set(key, JSON.stringify(results), 'EX', this.TTL_SECONDS);
    this.logger.log(`Cached results for ${key}`);
  }
}
