import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { SectionDataSchemaRegistry } from '../schemas/section-data-contracts';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import * as crypto from 'crypto';

@Injectable()
export class CodeRepairSkill implements Skill {
  readonly name = 'CodeRepair';
  private readonly logger = new Logger(CodeRepairSkill.name);

  constructor(private readonly aiGateway: AIGatewayService) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { componentName, sectionType, brokenCode, errorLog, critique } = input.context;

    if (!brokenCode) {
      throw new Error('CodeRepairSkill requires brokenCode in context.');
    }
    
    const targetComponent = componentName || sectionType;

    const schema = (SectionDataSchemaRegistry as any)[targetComponent];
    let jsonSchemaStr = '';
    if (schema) {
      const fullJsonSchema = zodToJsonSchema(schema, targetComponent);
      const bareJsonSchema = fullJsonSchema.definitions ? fullJsonSchema.definitions[targetComponent] : fullJsonSchema;
      jsonSchemaStr = `\nDATA PROP JSON SCHEMA (STRICT CONTRACT):\n${JSON.stringify(bareJsonSchema, null, 2)}\n`;
    }

    const issueContext = errorLog 
      ? `\nCOMPILER ERROR LOG:\n-------------------\n${errorLog}\n-------------------\n`
      : `\nQUALITY CONTROL CRITIQUE (Fix these missing/broken UI elements):\n-------------------\n${Array.isArray(critique) ? critique.map(c => '- ' + c).join('\n') : critique}\n-------------------\n`;

    const prompt = `
You are an expert React and Next.js developer acting as a code repair agent.
You previously generated the following component, but it failed our Quality Control or Compilation step.

SECTION TYPE: ${targetComponent}
${jsonSchemaStr}

BROKEN COMPONENT SOURCE CODE:
-------------------
${brokenCode}
-------------------
${issueContext}
YOUR TASK:
Fix the component so it satisfies all constraints and issues raised.
1. The component must still be named "${targetComponent}".
2. It must still accept the \`{ data }: any\` prop and strictly follow the JSON Schema. Do NOT invent new props.
3. If the critique mentions missing UI blocks (e.g. Map iframe, hours, buttons), you MUST implement them using Tailwind CSS.
4. CLIENT COMPONENT RULE: If you use hooks (useState, etc), add "use client"; at the top.
5. Return ONLY the raw fixed .tsx code. No markdown fences, no explanations. Just the code.
`;

    this.logger.log(`Running CodeRepairSkill for ${targetComponent}`);

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY raw React .tsx code. No markdown formatting, no explanations.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 8192,
    });

    let code = response.text.trim();

    if (code.startsWith('```')) {
      const lines = code.split('\n');
      if (lines[0].startsWith('```')) lines.shift();
      if (lines[lines.length - 1].startsWith('```')) lines.pop();
      code = lines.join('\n').trim();
    }

    const hash = crypto.createHash('sha256').update(code).digest('hex');

    return {
      data: { code }, // Match original return shape for compiler repair compatibility
      hash,
      model: 'claude-fable-5',
    };
  }
}
