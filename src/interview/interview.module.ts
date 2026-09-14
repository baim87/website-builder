import { Module, forwardRef } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { InterviewExtractorService } from './interview-extractor.service';
import { InterviewPromptBuilder } from './interview-prompt.builder';
import { ColorSuggestionService } from './color-suggestion.service';
import { ProjectsModule } from '../projects/projects.module';
import { ChatModule } from '../chat/chat.module';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [
    ProjectsModule,
    forwardRef(() => ChatModule),
    AIGatewayModule,
  ],
  providers: [InterviewService, InterviewExtractorService, InterviewPromptBuilder, ColorSuggestionService],
  exports: [InterviewService, ColorSuggestionService],
})
export class InterviewModule {}
