import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SKILL_STATUS } from './constants/skill-status.constant';

@Injectable()
export class CostAggregatorService {
  private readonly logger = new Logger(CostAggregatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async printCostReport(projectId: string, phase: 'generation' | 'repair' = 'generation', totalWallClockTimeMs?: number) {
    const invocations = await this.prisma.skillInvocation.findMany({
      where: { projectId, status: SKILL_STATUS.SUCCESS },
    });

    if (invocations.length === 0) {
      this.logger.log(`[Cost Report] No successful skill invocations found for project ${projectId}.`);
    }

    const imageAssets = await this.prisma.projectAsset.findMany({
      where: { projectId, cost: { not: null } },
    });

    let totalCost = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalAiLatencyMs = 0;
    
    let repairCost = 0;
    let repairPromptTokens = 0;
    let repairCompletionTokens = 0;
    
    let interviewCost = 0;
    let interviewPromptTokens = 0;
    let interviewCompletionTokens = 0;
    
    const pageCosts: Record<string, number> = {};
    const componentCosts: Record<string, number> = {};

    for (const inv of invocations) {
      const cost = inv.cost || 0;
      totalCost += cost;
      totalPromptTokens += inv.promptTokens || 0;
      totalCompletionTokens += inv.completionTokens || 0;
      totalAiLatencyMs += inv.latencyMs || 0;

      const meta: any = inv.metadata || {};
      
      if (meta.phase === 'repair') {
        repairCost += cost;
        repairPromptTokens += inv.promptTokens || 0;
        repairCompletionTokens += inv.completionTokens || 0;
      }

      if (meta.phase === 'interview') {
        interviewCost += cost;
        interviewPromptTokens += inv.promptTokens || 0;
        interviewCompletionTokens += inv.completionTokens || 0;
      }

      if (meta.pageSlug) {
        pageCosts[meta.pageSlug] = (pageCosts[meta.pageSlug] || 0) + cost;
      }

      if (meta.componentName) {
        componentCosts[meta.componentName] = (componentCosts[meta.componentName] || 0) + cost;
      }
    }

    let imageCost = 0;
    let imageCount = 0;
    for (const asset of imageAssets) {
      if (asset.cost) {
        imageCost += asset.cost;
        imageCount++;
      }
    }
    totalCost += imageCost;

    this.logger.log(`\n================ COST REPORT: ${projectId} (${phase.toUpperCase()}) ================`);
    this.logger.log(`Total Cost: $${totalCost.toFixed(5)}`);
    this.logger.log(`Total Tokens: (In: ${totalPromptTokens.toLocaleString()}, Out: ${totalCompletionTokens.toLocaleString()})`);
    
    if (totalWallClockTimeMs) {
      this.logger.log(`Total Generation Time: ${(totalWallClockTimeMs / 1000).toFixed(1)}s`);
    } else {
      this.logger.log(`Total AI Latency: ${(totalAiLatencyMs / 1000).toFixed(1)}s`);
    }
    
    if (repairCost > 0) {
      this.logger.log(`\n--- Repair Phase ---`);
      this.logger.log(`Repair Cost: $${repairCost.toFixed(5)}`);
      this.logger.log(`Repair Tokens: (In: ${repairPromptTokens.toLocaleString()}, Out: ${repairCompletionTokens.toLocaleString()})`);
    }

    if (interviewCost > 0) {
      this.logger.log(`\n--- Chat & Interview Phase ---`);
      this.logger.log(`Interview Cost: $${interviewCost.toFixed(5)}`);
      this.logger.log(`Interview Tokens: (In: ${interviewPromptTokens.toLocaleString()}, Out: ${interviewCompletionTokens.toLocaleString()})`);
    }

    if (imageCost > 0) {
      this.logger.log(`\n--- Image Generation Phase ---`);
      this.logger.log(`Image Cost: $${imageCost.toFixed(5)}`);
      this.logger.log(`Images Generated: ${imageCount}`);
    }

    this.logger.log(`\n--- Cost By Page ---`);
    for (const [page, cost] of Object.entries(pageCosts)) {
      this.logger.log(` - ${page}: $${cost.toFixed(5)}`);
    }

    this.logger.log(`\n--- Cost By Component ---`);
    for (const [comp, cost] of Object.entries(componentCosts)) {
      this.logger.log(` - ${comp}: $${cost.toFixed(5)}`);
    }
    this.logger.log(`========================================================================\n`);
  }
}
