import type { DesktopAuthError, DesktopLoginInput } from '../shared/electron-api.js';
import {
  AuthContractError,
  parseApiAuthResponse,
  parseSafeApiError,
  type ApiAuthResponse,
} from './auth-contract.js';
import { validateApiBaseUrl } from './security.js';

const REQUEST_TIMEOUT_MILLISECONDS = 10_000;
const MAX_RESPONSE_BYTES = 65_536;

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class AuthApiClient {
  private readonly apiOrigin: string;

  public constructor(
    apiOrigin: string,
    private readonly fetcher: FetchLike,
    private readonly deviceName: string,
  ) {
    this.apiOrigin = validateApiBaseUrl(apiOrigin);
  }

  public async login(input: DesktopLoginInput): Promise<ApiAuthResponse> {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ ...input, deviceName: this.deviceName }),
    });
    return parseApiAuthResponse(await this.readJson(response));
  }

  public async refresh(refreshToken: string): Promise<ApiAuthResponse> {
    const response = await this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    return parseApiAuthResponse(await this.readJson(response));
  }

  public async logout(accessToken: string): Promise<void> {
    await this.request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  private async request(pathname: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MILLISECONDS);
    const url = new URL(pathname, `${this.apiOrigin}/`);

    try {
      const response = await this.fetcher(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...init.headers,
        },
        redirect: 'error',
        signal: controller.signal,
      });
      this.assertResponseOrigin(response, url);

      if (!response.ok) {
        throw await this.toApiError(response);
      }

      return response;
    } catch (error) {
      if (error instanceof AuthContractError) throw error;
      if (isAbortError(error)) {
        throw new AuthContractError({
          code: 'API_TIMEOUT',
          message: 'O servidor demorou para responder. Tente novamente.',
        });
      }

      throw new AuthContractError({
        code: 'API_UNAVAILABLE',
        message: 'Não foi possível conectar ao servidor. Tente novamente em alguns instantes.',
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertResponseOrigin(response: Response, requestedUrl: URL): void {
    if (response.url === '') return;

    let responseUrl: URL;
    try {
      responseUrl = new URL(response.url);
    } catch {
      throw invalidResponseOrigin();
    }

    if (responseUrl.origin !== this.apiOrigin || responseUrl.pathname !== requestedUrl.pathname) {
      throw invalidResponseOrigin();
    }
  }

  private async toApiError(response: Response): Promise<AuthContractError> {
    if (response.status >= 400 && response.status < 500) {
      const body = await this.readJson(response, false);
      const safeError = parseSafeApiError(body, response.status);
      if (safeError !== undefined) return new AuthContractError(safeError);
    }

    const error: DesktopAuthError = {
      code: response.status >= 500 ? 'API_UNAVAILABLE' : 'API_REQUEST_FAILED',
      message:
        response.status >= 500
          ? 'O servidor está indisponível. Tente novamente em alguns instantes.'
          : 'Não foi possível concluir a autenticação.',
      status: response.status,
    };
    return new AuthContractError(error);
  }

  private async readJson(response: Response, required = true): Promise<unknown> {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      if (!required) return undefined;
      throw invalidResponseBody();
    }

    const text = await response.text();
    if (text.length === 0) {
      if (!required) return undefined;
      throw invalidResponseBody();
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      if (!required) return undefined;
      throw invalidResponseBody();
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      if (!required) return undefined;
      throw invalidResponseBody();
    }
  }
}

function invalidResponseBody(): AuthContractError {
  return new AuthContractError({
    code: 'INVALID_API_RESPONSE',
    message: 'O servidor retornou uma resposta de autenticação inválida.',
  });
}

function invalidResponseOrigin(): AuthContractError {
  return new AuthContractError({
    code: 'UNTRUSTED_API_RESPONSE',
    message: 'A resposta de autenticação veio de uma origem não confiável.',
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
