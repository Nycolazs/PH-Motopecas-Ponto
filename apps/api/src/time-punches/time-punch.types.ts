import type { Prisma } from '../generated/prisma/client.js';
import type { TimePunchMutationResponseDto } from './time-punch.dto.js';

export interface MutationHttpResult<TResponse extends TimePunchMutationResponseDto> {
  body: TResponse;
  replayed: boolean;
}

export function toIdempotencyJson(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}
