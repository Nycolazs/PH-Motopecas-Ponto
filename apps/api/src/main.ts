import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { configureApplication } from './bootstrap.js';
import type { EnvironmentVariables } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: true,
  });
  configureApplication(app);

  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const host = config.get('API_HOST', { infer: true });
  const port = config.get('API_PORT', { infer: true });

  await app.listen(port, host);
  Logger.log(`API listening on ${host}:${port}`, 'Bootstrap');
}

void bootstrap();
