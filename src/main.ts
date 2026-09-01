import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Security ─────────────────────────────────────
  app.use(helmet());
  app.use(cookieParser());

  // ── CORS ─────────────────────────────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // ── Global prefix ─────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Validation ────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException(errors),
    }),
  );

  // ── Swagger ───────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('NestJS Prisma OAuth2 Starter')
    .setDescription('Authentication & User management API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter the JWT returned by POST /api/v1/auth/signin',
      },
      'JWT',
    )
    .build();

  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(` Server is running on http://localhost:${port}`);
  console.log(` Swagger docs at   http://localhost:${port}/docs`);
}

bootstrap().catch((err: unknown) => {
  console.error('Application failed to start:', err);
  process.exit(1);
});
