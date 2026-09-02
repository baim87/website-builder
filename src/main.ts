import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  
  app.setGlobalPrefix('api');
  
  app.use(cookieParser());
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3001';
      if (!origin || origin === allowedOrigin || /\.vercel\.app$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  if (process.env.APP_MODE === 'worker') {
    await app.init();
    console.log('Worker initialized (no HTTP server)');
  } else {
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`API server listening on port ${port}`);
  }
}
bootstrap();
