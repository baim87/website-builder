import { Module, Global } from '@nestjs/common';
import { VercelClient } from './vercel.client';

@Global()
@Module({
  providers: [VercelClient],
  exports: [VercelClient],
})
export class VercelModule {}
