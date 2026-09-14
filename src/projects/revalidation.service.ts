import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async triggerRevalidation(projectId: string) {
    try {
      const domain = await this.prisma.domain.findUnique({
        where: { projectId },
      });

      if (!domain || !domain.domainName) {
        this.logger.debug(`No domain found for project ${projectId}, skipping revalidation.`);
        return;
      }

      const secret = process.env.BUILDER_API_SECRET || '';
      if (!secret) {
        this.logger.warn(`BUILDER_API_SECRET is missing. Cannot revalidate ${domain.domainName}.`);
        return;
      }

      const url = `https://${domain.domainName}/api/revalidate`;
      this.logger.log(`Triggering on-demand revalidation for ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-builder-api-key': secret,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Revalidation failed for ${url} - Status ${response.status}: ${errorText}`);
      } else {
        this.logger.log(`Successfully revalidated ${domain.domainName}`);
      }
    } catch (error: any) {
      this.logger.error(`Exception during revalidation for project ${projectId}: ${error.message}`);
    }
  }
}
