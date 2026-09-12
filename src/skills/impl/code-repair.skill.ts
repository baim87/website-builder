import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { SectionDataSchemaRegistry } from '../schemas/section-data-contracts';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import { getThemeById } from '../constants/theme-definitions.constant';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';

@Injectable()
export class CodeRepairSkill implements Skill {
  readonly name = AISkill.CODE_REPAIR;
  private readonly logger = new Logger(CodeRepairSkill.name);

  constructor(private readonly aiGateway: AIGatewayService) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { componentName, sectionType, brokenCode, errorLog, critique, themePreference } = input.context;

    if (!brokenCode) {
      throw new Error('CodeRepairSkill requires brokenCode in context.');
    }
    
    const targetComponent = componentName || sectionType;
    
    const theme = themePreference ? getThemeById(themePreference) : undefined;
    let themeHints = '';
    if (theme && theme.componentStyleRules && !theme.componentStyleRules.includes('TODO')) {
      themeHints = `\nTHEME INSTRUCTION: You MUST preserve and strictly follow these '${theme.label}' design principles when repairing the component.
Design System Hints: ${theme.designSystemHints}
Component Rules: ${theme.componentStyleRules}
Typography Rules: Headings: ${theme.typographyHints?.headingStyle} | Body: ${theme.typographyHints?.bodyStyle}\n`;
    }

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
${issueContext}${themeHints}
YOUR TASK:
Fix the component so it satisfies all constraints and issues raised.
1. The component must still be named "${targetComponent}".
2. It must still accept the \`{ data }: any\` prop and strictly follow the JSON Schema. Do NOT invent new props.
3. If the critique mentions missing UI blocks (e.g. Map iframe, hours, buttons), you MUST implement them using Tailwind CSS.
4. CLIENT COMPONENT RULE: If you use hooks (useState, etc), add "use client"; at the top.
5. PAGESPEED/LIGHTHOUSE ISSUES: If the critique mentions PageSpeed issues, prioritize them to achieve a 100% score while maintaining a beautiful, human-friendly design.
   - For Global SEO issues (e.g. Meta tags, Title), fix them.
   - For Element-Level issues (e.g. missing alt text, contrast), cross-reference the failing HTML snippets provided. If your component generates that exact HTML, implement the fix. If not, IGNORE the issue.
6. Return ONLY the raw fixed .tsx code. No markdown fences, no explanations. Just the code.
`;

    this.logger.log(`Running CodeRepairSkill for ${targetComponent}`);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
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
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
