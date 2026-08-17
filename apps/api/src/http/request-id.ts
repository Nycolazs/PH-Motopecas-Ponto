import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;

export interface RequestWithId extends Request {
  requestId: string;
}

export function requestIdFrom(request: Request): string {
  const requestId = (request as Partial<RequestWithId>).requestId;
  return typeof requestId === 'string' ? requestId : randomUUID();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  public use(request: RequestWithId, response: Response, next: NextFunction): void {
    const suppliedRequestId = request.header('x-request-id');
    const requestId =
      suppliedRequestId !== undefined && SAFE_REQUEST_ID.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();

    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  }
}
