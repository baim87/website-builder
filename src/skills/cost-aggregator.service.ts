import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CostAggregatorService {
  private readonly logger = new Logger(CostAggregatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async printCostReport(projectId: string, phase: 'generation' | 'repair' = 'generation', totalWallClockTimeMs?: number) {
    const invocations = await this.prisma.skillInvocation.findMany({
      where: { projectId, status: 'success' },
    });

    if (invocations.length === 0) {
      this.logger.log(`[Cost Report] No successful invocations found for project ${projectId}.`);
      return;
    }

    let totalCost = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalAiLatencyMs = 0;
    
    let repairCost = 0;
    let repairPromptTokens = 0;
    let repairCompletionTokens = 0;
    
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

      if (meta.pageSlug) {
        pageCosts[meta.pageSlug] = (pageCosts[meta.pageSlug] || 0) + cost;
      }

      if (meta.componentName) {
        componentCosts[meta.componentName] = (componentCosts[meta.componentName] || 0) + cost;
      }
    }

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
