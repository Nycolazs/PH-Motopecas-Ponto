import { createHmac } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { requestIdFrom } from '../http/request-id.js';
import { AUTH_CONFIGURATION } from './auth.constants.js';
import type { AuthConfiguration, ClientContext } from './auth.types.js';
import { stripControlCharacters } from './text-sanitization.js';

function cleanUserAgent(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const cleaned = stripControlCharacters(value).trim().slice(0, 512);
  return cleaned.length > 0 ? cleaned : undefined;
}

@Injectable()
export class ClientContextService {
  public constructor(
    @Inject(AUTH_CONFIGURATION) private readonly configuration: AuthConfiguration,
  ) {}

  public fromRequest(request: Request): ClientContext {
    // Express request.ip is authoritative after the application's bounded trust-proxy setup.
    const clientIp = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const requestId = requestIdFrom(request);
    const userAgent = cleanUserAgent(request.header('user-agent'));

    return {
      ipHash: this.hashSensitiveValue('client-ip', clientIp),
      ...(userAgent === undefined ? {} : { userAgent }),
      requestId,
    };
  }

  public hashLoginBucket(normalizedLogin: string): string {
    return this.hashSensitiveValue('login-throttle', normalizedLogin);
  }

  public hashIpBucket(ipHash: string): string {
    return this.hashSensitiveValue('ip-throttle', ipHash);
  }

  private hashSensitiveValue(purpose: string, value: string): string {
    return createHmac('sha256', this.configuration.refreshSecret)
      .update(`ph-ponto:${purpose}:`, 'utf8')
      .update(value, 'utf8')
      .digest('hex');
  }
}
