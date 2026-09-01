import { Module } from '@nestjs/common';
import { GbpService } from './gbp.service';
import { GbpController } from './gbp.controller';

@Module({
  controllers: [GbpController],
  providers: [GbpService],
  exports: [GbpService],
})
export class GbpModule {}
