import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PRODUCT_NAME } from '@ph-ponto/shared';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

import type { EnvironmentVariables } from './config/environment.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';
import { createValidationPipe } from './http/validation.js';

export function configureApplication(app: NestExpressApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const nodeEnvironment = config.get('NODE_ENV', { infer: true });
  const allowedOrigins = new Set(['ph-ponto://app']);

  const adminWebOrigin = config.get('ADMIN_WEB_ORIGIN', { infer: true });
  if (adminWebOrigin) {
    for (const origin of adminWebOrigin.split(',')) {
      const trimmed = origin.trim().replace(/\/+$/, '');
      if (trimmed.length > 0) {
        allowedOrigins.add(trimmed);
      }
    }
  }

  if (nodeEnvironment !== 'production') {
    allowedOrigins.add(config.get('DESKTOP_DEV_ORIGIN', { infer: true }));
    allowedOrigins.add(config.get('API_BASE_URL', { infer: true }));
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://127.0.0.1:5173');
    allowedOrigins.add('http://localhost:3333');
    allowedOrigins.add('http://127.0.0.1:3333');
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://127.0.0.1:3000');
  }

  app.set('trust proxy', config.get('TRUST_PROXY_COUNT', { infer: true }));
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['Idempotency-Replayed', 'X-Request-Id'],
    maxAge: 600,
    origin: (origin, callback) => {
      if (
        origin === undefined ||
        allowedOrigins.has(origin) ||
        adminWebOrigin === '*' ||
        (adminWebOrigin?.includes('*.vercel.app') && origin.endsWith('.vercel.app'))
      ) {
        callback(null, true);
        return;
      }

      callback(
        new ForbiddenException({
          code: 'CORS_ORIGIN_FORBIDDEN',
          message: 'Origem não permitida.',
        }),
        false,
      );
    },
  });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(`${PRODUCT_NAME} API`)
      .setDescription('API interna de controle de ponto da PH Motopeças.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
      customSiteTitle: `${PRODUCT_NAME} API`,
    });
  }
}
