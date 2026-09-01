import { Injectable, Logger } from '@nestjs/common';
import { WebsiteDataService } from '../projects/website-data.service';
import { GenerationProducer } from '../queue/producers/generation.producer';

@Injectable()
export class EditExecutorService {
  private readonly logger = new Logger(EditExecutorService.name);

  constructor(
    private readonly websiteDataService: WebsiteDataService,
    private readonly generationProducer: GenerationProducer,
  ) {}

  async applyEdits(projectId: string, intent: any, currentWebsiteData: any): Promise<void> {
    if (!intent.changes || intent.changes.length === 0) {
      return;
    }

    const updatedData = { ...currentWebsiteData };
    const topLevelUpdates: Record<string, any> = {};

    for (const change of intent.changes) {
      const keys = change.path.split('.');
      const topLevelKey = keys[0];
      
      let current = updatedData;
      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined || current[keys[i]] === null) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = change.value;
      
      topLevelUpdates[topLevelKey] = updatedData[topLevelKey];
    }

    if (Object.keys(topLevelUpdates).length > 0) {
      this.logger.log(`Persisting edit changes for project ${projectId}`);
      await this.websiteDataService.upsert(projectId, topLevelUpdates);
    }

    if (intent.triggerRegeneration) {
      this.logger.log(`Queuing site regeneration for project ${projectId}`);
      await this.generationProducer.generateSite(projectId);
    }
  }
}
