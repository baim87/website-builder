import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatStreamService } from './chat-stream.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { InterviewModule } from '../interview/interview.module';
import { forwardRef } from '@nestjs/common';
import { EditIntentService } from './edit-intent.service';
import { EditExecutorService } from './edit-executor.service';
import { QueueModule } from '../queue/queue.module';
import { ProjectsModule } from '../projects/projects.module';

import { GuardrailsModule } from '../guardrails/guardrails.module';
import { ChatFlowEngine } from './chat-flow.engine';
import { SkillsModule } from '../skills/skills.module';
import { AssetsModule } from '../assets/assets.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { BrandModule } from '../brand/brand.module';
import { SeoModule } from '../seo/seo.module';
import { EditorModule } from '../editor/editor.module';

@Module({
  imports: [PrismaModule, AIGatewayModule, forwardRef(() => InterviewModule), QueueModule, ProjectsModule, GuardrailsModule, SkillsModule, AssetsModule, KeywordsModule, BrandModule, SeoModule, EditorModule],
  controllers: [ChatController],
  providers: [ChatService, ChatStreamService, EditIntentService, EditExecutorService, ChatFlowEngine],
  exports: [ChatService, ChatStreamService, EditIntentService, EditExecutorService, ChatFlowEngine],
})
export class ChatModule {}
