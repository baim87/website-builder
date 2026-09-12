import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { SectionSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';

import { AISkill } from '../../common/constants/ai-skills.constant';

@Injectable()
export class UIDesignerSkill implements Skill {
  readonly name = AISkill.UI_DESIGNER;
  private readonly logger = new Logger(UIDesignerSkill.name);

  constructor(
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { sectionType, copyData } = input.context;

    if (!sectionType || !copyData) {
      throw new Error('UIDesignerSkill requires sectionType and copyData in context.');
    }

    this.logger.log(`Designing AST deterministically for ${sectionType}...`);

    // We no longer use an LLM here to prevent data reshaping.
    // The copyData is already strictly validated against SectionDataSchemaRegistry.
    // We simply wrap it in an AST node so the UI can render it.
    
    const id = `${sectionType.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    const astNode = {
      id,
      type: sectionType,
      ast: {
        type: sectionType,
        props: {
          data: copyData.data || copyData, // copyData is { data: {...}, hash: ... } from CopyWriterSkill
        },
        children: []
      }
    };

    const validatedData = this.validator.validate(astNode, SectionSchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: 'deterministic',
    };
  }
}
