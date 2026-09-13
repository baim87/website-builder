import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { AssetPathResolverService } from '../assets/asset-path-resolver.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandKnowledgeService {
  private readonly logger = new Logger(BrandKnowledgeService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly pathResolver: AssetPathResolverService,
    private readonly prisma: PrismaService,
  ) {}

  async saveBrandFile(projectId: string, fileName: string, content: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const { key } = this.pathResolver.resolveBrandKnowledgePath(
      project.userId,
      projectId,
      fileName
    );

    const buffer = Buffer.from(content, 'utf-8');
    const url = await this.storage.upload(key, buffer, 'text/markdown');
    
    this.logger.log(`Saved Brand Knowledge file to ${url}`);
    
    return url;
  }

  async getBrandFile(projectId: string, fileName: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const { key } = this.pathResolver.resolveBrandKnowledgePath(
      project.userId,
      projectId,
      fileName
    );

    try {
      const buffer = await this.storage.download(key);
      return buffer.toString('utf-8');
    } catch (error) {
      this.logger.warn(`Failed to read Brand Knowledge file: ${fileName} for project ${projectId}. Error: ${error.message}`);
      return '';
    }
  }

  async getBrandFiles(projectId: string, fileNames: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    await Promise.all(
      fileNames.map(async (fileName) => {
        results[fileName] = await this.getBrandFile(projectId, fileName);
      })
    );
    return results;
  }
}
