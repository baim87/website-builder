import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GbpService } from './gbp.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

const LookupSchema = z.object({
  businessName: z.string().min(1),
  location: z.string().min(1),
});
type LookupDto = z.infer<typeof LookupSchema>;

@UseGuards(JwtAuthGuard)
@Controller('gbp')
export class GbpController {
  constructor(private readonly gbpService: GbpService) {}

  @Get('lookup')
  async lookup(@Query(new ZodValidationPipe(LookupSchema)) query: LookupDto) {
    const data = await this.gbpService.lookup(query.businessName, query.location);
    return { data };
  }
}
