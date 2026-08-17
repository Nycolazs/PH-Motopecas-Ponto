import { createHmac } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../config/environment.js';
import type { IdempotencyOperation } from '../generated/prisma/client.js';

type CanonicalValue = boolean | null | number | string | CanonicalValue[] | CanonicalObject;
interface CanonicalObject {
  [key: string]: CanonicalValue;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Idempotency fingerprints require finite numbers.');
    }

    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right, 'en'),
    );
    return `{${entries
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`)
      .join(',')}}`;
  }

  throw new TypeError('Unsupported idempotency fingerprint value.');
}

@Injectable()
export class IdempotencyHasherService {
  private readonly secret: string;

  public constructor(@Inject(ConfigService) config: ConfigService<EnvironmentVariables, true>) {
    this.secret = config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  public hashKey(actorId: string, operation: IdempotencyOperation, key: string): string {
    return this.hash('request-key', `${actorId}:${operation}:${key}`);
  }

  public fingerprint(operation: IdempotencyOperation, payload: unknown): string {
    return this.hash('request-fingerprint', `${operation}:${canonicalize(payload)}`);
  }

  private hash(purpose: string, value: string): string {
    return createHmac('sha256', this.secret)
      .update(`ph-ponto:idempotency:${purpose}:`, 'utf8')
      .update(value, 'utf8')
      .digest('hex');
  }
}
