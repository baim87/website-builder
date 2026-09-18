import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildComponentGeneratorPrompt } from '../prompts/builders/component-generator.prompt';
import { parseMarkdownFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class ComponentGeneratorSkill implements Skill {
  readonly name = AISkill.COMPONENT_GENERATOR;
  private readonly logger = new Logger(ComponentGeneratorSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
  ) { }

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { sectionType, brandVisual, sampleData, themePreference, designTokens } = input.context;

    if (!sectionType) {
      throw new Error('ComponentGeneratorSkill requires sectionType in context.');
    }

    const prompt = buildComponentGeneratorPrompt(
      sectionType,
      brandVisual,
      sampleData,
      themePreference,
      designTokens
    );

    this.logger.log(`Generating .tsx code for component: ${sectionType}`);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You output ONLY raw React .tsx code. No markdown formatting, no explanations.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: 8192,
    });

    let code = parseMarkdownFromLlm(response.text);

    // Auto-inject "use client" if the component uses React hooks but forgot the directive
    const usesHooks = /\b(useState|useEffect|useRef|useCallback|useMemo|useReducer|useContext)\b/.test(code);
    if (usesHooks && !code.includes('"use client"') && !code.includes("'use client'")) {
      this.logger.warn(`Component ${sectionType} uses React hooks but missing "use client" — auto-injecting.`);
      code = '"use client";\n' + code;
    }

    // Auto-strip non-existent lucide-react brand icons (Facebook, Instagram, Twitter, etc.)
    const invalidIcons = ['Facebook', 'Instagram', 'Twitter', 'Linkedin', 'Youtube', 'Tiktok', 'Pinterest', 'Snapchat', 'Github', 'Dribbble', 'Behance'];
    code = code.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g,
      (_match, imports) => {
        const cleaned = imports
          .split(',')
          .map((i: string) => i.trim())
          .filter((i: string) => !invalidIcons.includes(i) && i.length > 0);
        if (cleaned.length === 0) return '// lucide-react import removed (invalid icons)';
        return `import { ${cleaned.join(', ')} } from 'lucide-react'`;
      }
    );

    // Ensure first-letter modifiers are responsive (sm: breakpoint minimum)
    // Restricted to className attributes to avoid breaking text nodes or other properties
    code = code.replace(/className=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g, (match, doubleQ, singleQ, braces) => {
      const classContent = doubleQ ?? singleQ ?? braces ?? "";
      const wrapperStart = match.startsWith('className={') ? '{' : match.startsWith("className='") ? "'" : '"';
      const wrapperEnd = match.startsWith('className={') ? '}' : match.startsWith("className='") ? "'" : '"';

      const replacedContent = classContent.replace(/(?<![smxl234]:)\b([a-z0-9-]+:)?first-letter:[^\s"'`]+/g, (innerMatch: string) => {
        if (innerMatch.match(/^(sm|md|lg|xl|2xl):/)) {
          return innerMatch;
        }
        return `sm:${innerMatch}`;
      });

      return `className=${wrapperStart}${replacedContent}${wrapperEnd}`;
    });

    const hash = crypto.createHash('sha256').update(code).digest('hex');

    return {
      data: { code },
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
