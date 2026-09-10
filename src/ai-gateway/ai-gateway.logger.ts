import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AIGatewayLogger {
  private readonly logger = new Logger(AIGatewayLogger.name);

  logCall(model: string, latencyMs: number, usage: { promptTokens: number; completionTokens: number, cost?: number }) {
    const costStr = usage.cost !== undefined ? ` | Cost: $${usage.cost.toFixed(6)}` : '';
    this.logger.log(
      `[Model: ${model}] | Latency: ${latencyMs}ms | Tokens: (In: ${usage.promptTokens}, Out: ${usage.completionTokens})${costStr}`,
    );
  }

  logError(model: string, error: Error) {
    this.logger.error(`[Model: ${model}] Error: ${error.message}`, error.stack);
  }
}
