import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { ApiProblem, ApiProblemDetails } from '@ph-ponto/shared';
import type { Request, Response } from 'express';

import { requestIdFrom } from './request-id.js';

interface SafeExceptionPayload {
  code: string;
  message: string;
  details?: ApiProblemDetails;
}

const defaultProblems: Record<number, Pick<SafeExceptionPayload, 'code' | 'message'>> = {
  [HttpStatus.BAD_REQUEST]: { code: 'INVALID_REQUEST', message: 'Solicitação inválida.' },
  [HttpStatus.UNAUTHORIZED]: {
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Autenticação necessária.',
  },
  [HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', message: 'Você não tem permissão para esta ação.' },
  [HttpStatus.NOT_FOUND]: { code: 'RESOURCE_NOT_FOUND', message: 'Recurso não encontrado.' },
  [HttpStatus.CONFLICT]: { code: 'CONFLICT', message: 'A solicitação entrou em conflito.' },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'RATE_LIMITED',
    message: 'Muitas tentativas. Tente novamente em instantes.',
  },
  [HttpStatus.INTERNAL_SERVER_ERROR]: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Não foi possível concluir a solicitação.',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDetails(value: unknown): ApiProblemDetails | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value);
  if (
    !entries.every(
      ([key, messages]) =>
        key.length > 0 &&
        Array.isArray(messages) &&
        messages.every((message) => typeof message === 'string'),
    )
  ) {
    return undefined;
  }

  return Object.fromEntries(entries) as ApiProblemDetails;
}

function readSafePayload(value: unknown): SafeExceptionPayload | undefined {
  if (!isRecord(value) || typeof value.code !== 'string' || typeof value.message !== 'string') {
    return undefined;
  }

  if (!/^[A-Z][A-Z0-9_]*$/.test(value.code)) {
    return undefined;
  }

  const details = readDetails(value.details);
  return {
    code: value.code,
    message: value.message,
    ...(details === undefined ? {} : { details }),
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const safePayload =
      exception instanceof HttpException ? readSafePayload(exception.getResponse()) : undefined;
    const fallback = defaultProblems[status] ?? defaultProblems[HttpStatus.INTERNAL_SERVER_ERROR]!;
    const problem: ApiProblem = {
      status,
      code: safePayload?.code ?? fallback.code,
      message: safePayload?.message ?? fallback.message,
      ...(safePayload?.details === undefined ? {} : { details: safePayload.details }),
      requestId: requestIdFrom(request),
      timestamp: new Date().toISOString(),
    };

    if (!(exception instanceof HttpException) || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const errorName = exception instanceof Error ? exception.name : 'UnknownError';
      this.logger.error({
        event: 'http_request_failed',
        errorName,
        method: request.method,
        path: request.path,
        requestId: problem.requestId,
        status,
      });
    }

    response.status(status).json(problem);
  }
}
