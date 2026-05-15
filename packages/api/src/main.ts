import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/index.js';
import { TransformInterceptor } from './common/interceptors/index.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS — strict for the cookie-bearing web session, permissive for
  // cross-origin OAuth / MCP clients that authenticate via Bearer
  // tokens (Inspector on localhost, claude.ai web custom connectors,
  // ChatGPT remote MCP servers). Requests without an Origin header
  // (curl, server-to-server) are always allowed.
  const configuredOrigins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const isOriginAllowed = (origin: string): boolean => {
    if (configuredOrigins.includes(origin)) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
      return true;
    }
    if (
      /^https:\/\/([a-z0-9-]+\.)?(claude\.ai|anthropic\.com|chatgpt\.com|openai\.com)$/.test(
        origin,
      )
    ) {
      return true;
    }
    return false;
  };

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      callback(null, isOriginAllowed(origin));
    },
    credentials: true,
    exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'],
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Response transform — respects @RawResponse() on RFC-bound routes.
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('BB Project Management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
