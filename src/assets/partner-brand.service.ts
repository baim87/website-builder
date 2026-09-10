import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { StorageService } from '../storage/storage.service';
import { AssetPathResolverService } from './asset-path-resolver.service';
import { ImageOptimizationService } from '../images/image-optimization.service';
import axios from 'axios';
import { z } from 'zod';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';

const BrandsSchema = z.object({
  brands: z.array(z.object({
    brandName: z.string().describe('The name of the brand (e.g., Trex)'),
    domain: z.string().describe('The official website domain of the brand without www or http (e.g., trex.com)'),
  })),
});

@Injectable()
export class PartnerBrandService {
  private readonly logger = new Logger(PartnerBrandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AIGatewayService,
    private readonly storageService: StorageService,
    private readonly pathResolver: AssetPathResolverService,
    private readonly imageOptimization: ImageOptimizationService,
  ) { }

  /**
   * Orchestrates extracting, fetching, and caching partner brands.
   */
  async processPartnerBrands(projectId: string, trade: string, services: any[]): Promise<void> {
    try {
      this.logger.log(`Extracting partner brands for project ${projectId} (Trade: ${trade})`);
      const extractedBrands = await this.extractBrands(trade, services);

      if (!extractedBrands || extractedBrands.length === 0) {
        this.logger.log(`No partner brands extracted for project ${projectId}`);
        return;
      }

      const uploadPromises = extractedBrands.map(brand => this.fetchAndCacheLogo(projectId, brand.domain, brand.brandName));
      await Promise.all(uploadPromises);

      this.logger.log(`Successfully processed partner brands for project ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to process partner brands for project ${projectId}: ${error.message}`);
    }
  }

  /**
   * Uses AI to extract or suggest premium material brands based on the trade.
   */
  private async extractBrands(trade: string, services: any[]): Promise<{ brandName: string; domain: string }[]> {
    const fullJsonSchema = zodToJsonSchema(BrandsSchema, 'BrandsList');
    let bareJsonSchema: any = fullJsonSchema.definitions ? fullJsonSchema.definitions['BrandsList'] : fullJsonSchema;
    if (bareJsonSchema.$schema) delete bareJsonSchema.$schema;

    const prompt = `Based on the following trade and services, identify 4 to 6 top premium material/partner brands that this contractor likely uses.
Trade: ${trade}
Services: ${JSON.stringify(services)}

CRITICAL CONSTRAINTS:
- NEVER include cheap retail/hardware stores (e.g., Home Depot, Lowe's, Menards, Ace Hardware, Harbor Freight) in United States.
- ONLY include actual manufacturers or premium brands (e.g. Trex, Timbertech, GAF, Sherwin Williams).
- Provide their exact official domain (e.g. trex.com).
`;

    const response = await this.aiGateway.generateText('anthropic/claude-fable-5', {
      systemPrompt: 'You are an industry expert in construction and contractor materials. Respond ONLY with valid JSON using the provided schema tool.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1024,
      temperature: 0.2,
      schema: bareJsonSchema,
      schemaName: 'BrandsList',
    });

    try {
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      const parsed = JSON.parse(raw);
      const validated = BrandsSchema.parse(parsed);
      return validated.brands;
    } catch (e) {
      this.logger.error(`Failed to parse extracted partner brands: ${response.text}`);
      return [];
    }
  }

  /**
   * Checks R2 cache, then fetches from Primary (Brandfetch) or Fallback (Logo.dev)
   */
  public async fetchAndCacheLogo(projectId: string, domain: string, brandName: string): Promise<string | null> {
    const extension = 'webp';
    const globalPath = this.pathResolver.resolveGlobalBrandLogoPath(domain, extension);
    const cdnBaseUrl = process.env.R2_PUBLIC_URL || 'https://assets.example.com';
    let globalUrl = `${cdnBaseUrl}/${globalPath}`;

    let exists = false;
    try {
      await axios.head(globalUrl);
      exists = true;
    } catch {
      exists = false;
    }

    if (exists) {
      this.logger.debug(`Cache HIT for ${brandName} (${domain}) logo in global R2.`);
    } else {
      this.logger.debug(`Cache MISS for ${brandName} (${domain}) logo. Fetching from APIs...`);
      let buffer: Buffer | null = null;
      let contentType = 'image/webp';

      buffer = await this.fetchFromBrandfetch(domain);

      if (!buffer) {
        buffer = await this.fetchFromLogoDev(domain);
      }

      if (buffer) {
        // Optimize to WebP
        const webpBuffer = await this.imageOptimization.optimizeToWebp(buffer);
        globalUrl = await this.storageService.upload(globalPath, webpBuffer, contentType);
        this.logger.log(`Successfully cached ${domain} logo to global R2: ${globalUrl}`);
      } else {
        this.logger.warn(`Failed to fetch logo for ${domain} from both Primary and Fallback APIs.`);
        return null;
      }
    }

    if (globalUrl) {
      const existing = await this.prisma.asset.findFirst({
        where: { projectId, purpose: 'partner_brand', url: globalUrl }
      });

      if (!existing) {
        await this.prisma.asset.create({
          data: {
            projectId,
            url: globalUrl,
            type: 'image',
            purpose: 'partner_brand',
            section: brandName,  // store brandName here — Asset has no name column
          }
        });
      }
      return globalUrl;
    }
    return null;
  }


  public async extractSingleBrand(brandName: string): Promise<{ brandName: string; domain: string } | null> {
    const prompt = `The user requested the logo for the brand: "${brandName}". 
Please provide the exact official domain for this brand (e.g. ${brandName.toLowerCase().replace(/\s+/g, '')}.com).
If you are unsure, make your best educated guess.`;

    const response = await this.aiGateway.generateText('anthropic/claude-fable-5', {
      systemPrompt: 'You are an industry expert in construction and contractor materials in United States. Respond ONLY with valid JSON using the provided schema tool.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1024,
      temperature: 0.2,
      schema: {
        type: 'object',
        properties: {
          brands: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                brandName: { type: 'string' },
                domain: { type: 'string' }
              },
              required: ['brandName', 'domain']
            }
          }
        },
        required: ['brands']
      },
      schemaName: 'BrandsList',
    });

    try {
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      const parsed = JSON.parse(raw);
      if (parsed.brands && parsed.brands.length > 0) {
        return parsed.brands[0];
      }
    } catch (e) {
      this.logger.error(`Failed to extract single brand domain: ${response.text}`);
    }
    return null;
  }

  private async fetchFromBrandfetch(domain: string): Promise<Buffer | null> {
    if (!process.env.BRANDFETCH_API_KEY) return null;
    try {
      const response = await axios.get(`https://api.brandfetch.io/v2/brands/${domain}`, {
        headers: { 'Authorization': `Bearer ${process.env.BRANDFETCH_API_KEY}` }
      });
      const logos = response.data?.logos || [];
      if (logos.length > 0) {
        const formats = logos[0].formats || [];
        const format = formats.find((f: any) => f.format === 'png') || formats[0];
        if (format && format.src) {
          const imgResponse = await axios.get(format.src, { responseType: 'arraybuffer' });
          return Buffer.from(imgResponse.data);
        }
      }
    } catch (e) {
      this.logger.warn(`Brandfetch failed for ${domain}: ${e.message}`);
    }
    return null;
  }

  private async fetchFromLogoDev(domain: string): Promise<Buffer | null> {
    if (!process.env.LOGODEV_SECRET_KEY) return null;
    try {
      const url = `https://img.logo.dev/${domain}?token=${process.env.LOGODEV_SECRET_KEY}&format=png`;
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (e) {
      this.logger.warn(`Logo.dev failed for ${domain}: ${e.message}`);
    }
    return null;
  }
}
