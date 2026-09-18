import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BrandStorySkill } from '../src/skills/impl/brand-story.skill';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const skill = app.get(BrandStorySkill);

  console.log('Sending mock request to AIGateway via BrandStorySkill...');
  
  const result = await skill.execute({
    projectId: 'test-project',
    context: {
      businessContext: {
        businessName: 'Apex Contracting',
        trade: 'General Contractor',
        brandIdentityInputs: {
          founderStory: 'skip'
        }
      },
      brandStrategy: 'Brand strategy text goes here.'
    },
    metadata: {}
  });

  console.log('\n--- LLM OUTPUT ---\n');
  console.log(result.data);
  console.log('\n------------------\n');

  await app.close();
}
bootstrap().catch(console.error);
