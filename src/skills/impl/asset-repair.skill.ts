import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildAssetRepairPrompt } from '../prompts/builders/asset-repair.prompt';

@Injectable()
export class AssetRepairSkill implements Skill {
  readonly name = AISkill.ASSET_REPAIR;
  private readonly logger = new Logger(AssetRepairSkill.name);

  constructor(private readonly aiGateway: AIGatewayService) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { originalPrompt, critique } = input.context;

    if (!originalPrompt || !critique) {
      throw new Error('AssetRepairSkill requires originalPrompt and critique in context.');
    }

    const systemPrompt = buildAssetRepairPrompt(originalPrompt, critique);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt,
      messages: [{ role: 'user', content: 'Rewrite the prompt to fix the issues.' }],
      temperature: 0.7,
      maxTokens: 8192
    });

    const fixedPrompt = response.text.trim();
    this.logger.log(`Rewrote broken prompt. New prompt: ${fixedPrompt.substring(0, 50)}...`);

    return {
      hash: 'asset-repair-' + Date.now(),
      model: AIModel.CLAUDE_FABLE_5,
      usage: response.usage,
      data: { fixedPrompt }
    };
  }
}
