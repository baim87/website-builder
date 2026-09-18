import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DeploymentService } from '../src/deployment/deployment.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const deploymentService = app.get(DeploymentService);
  
  // Use the ID of the most recent project (Offcut Interiors)
  const projectId = '0de511ef-e38c-4176-bb3e-faa89c6fbb6e';
  // Note: normally we would pull the user ID from the DB
  const userId = 'b0f80720-eb41-4cf1-ba76-bdce3a53bc77'; // Mock or actual user ID doesn't matter much for admin script if we bypass it, but DeploymentService needs it.
  
  try {
      console.log('Linking Vercel to GitHub repository...');
      const result = await deploymentService.linkProjectToGithub(
          projectId, 
          userId, 
          'ads-baim', 
          'offcut-interiors-home-remodeling-0de5'
      );
      console.log('Result:', result);
      console.log('Done! Now anytime you push to this GitHub repo, Vercel will deploy it automatically.');
  } catch (err) {
      console.error(err);
  }
  
  await app.close();
}

bootstrap();
