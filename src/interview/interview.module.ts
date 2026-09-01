import { Module, forwardRef } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { InterviewExtractorService } from './interview-extractor.service';
import { InterviewPromptBuilder } from './interview-prompt.builder';
import { ProjectsModule } from '../projects/projects.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    ProjectsModule,
    forwardRef(() => ChatModule),
  ],
  providers: [InterviewService, InterviewExtractorService, InterviewPromptBuilder],
  exports: [InterviewService],
})
export class InterviewModule {}
