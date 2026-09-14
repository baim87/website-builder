import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { AIModel } from '../common/constants/ai-models.constant';

@Injectable()
export class SeasonalityService {
  private readonly logger = new Logger(SeasonalityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AIGatewayService,
  ) {}

  async generateSeasonalConfig(projectId: string): Promise<any> {
    const businessContext = await this.prisma.businessContext.findUnique({ where: { projectId } });
    const mainService = await this.prisma.serviceKeywordMetrics.findFirst({
      where: { projectId, rank: 1 },
    });

    let peakMonths: number[] = [];
    
    // 1. Try mathematically calculating peaks from Google Ads monthlyVolumes
    if (mainService?.monthlyVolumes && Array.isArray(mainService.monthlyVolumes) && mainService.monthlyVolumes.length > 0) {
       peakMonths = this.calculatePeaksFromData(mainService.monthlyVolumes);
    }
    
    // 2. AI Fallback: If Google Ads API failed, returned mock data, or no distinct peaks
    if (peakMonths.length === 0) {
       this.logger.warn(`No seasonal data from Google Ads for ${mainService?.service}. Falling back to AI heuristic.`);
       peakMonths = await this.aiInferPeakMonths(mainService?.service || 'contractor', businessContext?.location || '');
    }

    // 3. Generate the compelling offer copy via AI based on the main service
    const message = await this.generateAnnouncementCopy(mainService?.service || 'contractor');

    return {
      message,
      ctaText: 'Claim Offer',
      ctaLink: '/contact',
      peakMonths,
      peakKeyword: mainService?.keyword,
      peakService: mainService?.service,
    };
  }

  private calculatePeaksFromData(monthlyVolumes: any[]): number[] {
    if (monthlyVolumes.length === 0) return [];

    const totalVolume = monthlyVolumes.reduce((sum, item) => sum + Number(item.monthlySearches), 0);
    const avgVolume = totalVolume / monthlyVolumes.length;
    
    // Threshold for high season is 30% above the monthly average
    const threshold = avgVolume * 1.3;
    
    const peakMonths = monthlyVolumes
      .filter(item => Number(item.monthlySearches) >= threshold)
      .map(item => this.monthStringToNumber(item.month));

    return peakMonths.filter(m => m !== 0); // Exclude unparseable months
  }

  private async aiInferPeakMonths(service: string, state: string): Promise<number[]> {
    const prompt = `
      You are an expert in local service seasonality.
      Based on weather and general consumer trends in ${state || 'the US'}, what are the peak high-season months (1-12) for a contractor providing "${service}"?
      Return ONLY a valid JSON array of month numbers. Do not output anything else.
      Example: [5, 6, 7, 8]
    `;

    try {
      const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
        systemPrompt: 'You are a helpful assistant. Always output a clean JSON array of numbers.',
        messages: [{ role: 'user', content: prompt }],
        schema: {
          type: 'array',
          items: { type: 'number' }
        },
        schemaName: 'PeakMonths'
      });
      return JSON.parse(response.text) as number[];
    } catch (e: any) {
      this.logger.error(`AI Peak Month Fallback failed: ${e.message}`);
      // Absolute worst-case fallback: Summer months
      return [5, 6, 7, 8];
    }
  }

  private async generateAnnouncementCopy(service: string): Promise<string> {
    const prompt = `
      Write a compelling, short announcement bar message offering a seasonal promotion for ${service}.
      Keep it under 50 characters. It must be short, compact, and punchy enough for mobile view. Do not include quotes.
      Examples:
      - Get 50% off labor until Sept 7th!
      - Book ${service} today and save 20%!
    `;

    try {
      const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
        systemPrompt: 'You are an expert copywriter.',
        messages: [{ role: 'user', content: prompt }],
      });
      return response.text.replace(/["']/g, '').trim();
    } catch (e) {
      return `Special offer on ${service} - Contact us today!`;
    }
  }

  private monthStringToNumber(month: string): number {
    const months: Record<string, number> = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
    };
    return months[month?.toLowerCase()] || 0;
  }
}
