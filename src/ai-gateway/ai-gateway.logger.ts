import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AIGatewayLogger {
  private readonly logger = new Logger(AIGatewayLogger.name);

  logCall(model: string, latencyMs: number, usage: { promptTokens: number; completionTokens: number }) {
    this.logger.log(
      `[Model: ${model}] | Latency: ${latencyMs}ms | Tokens: (In: ${usage.promptTokens}, Out: ${usage.completionTokens})`,
    );
  }

  logError(model: string, error: Error) {
    this.logger.error(`[Model: ${model}] Error: ${error.message}`, error.stack);
  }
}
