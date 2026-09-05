import { Module } from '@nestjs/common';
import { AIGatewayService } from './ai-gateway.service';
import { ClaudeFableAdapter } from './adapters/claude-fable.adapter';
import { OllamaCloudAdapter } from './adapters/ollama-cloud.adapter';
import { ModelRegistry } from './config/model-registry';
import { AIGatewayLogger } from './ai-gateway.logger';

@Module({
  providers: [
    AIGatewayService,
    ClaudeFableAdapter,
    OllamaCloudAdapter,
    ModelRegistry,
    AIGatewayLogger,
  ],
  exports: [AIGatewayService],
})
export class AIGatewayModule {}
