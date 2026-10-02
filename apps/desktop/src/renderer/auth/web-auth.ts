import type {
  DesktopAuthState,
  DesktopLoginInput,
  DesktopLogoutState,
} from '../../shared/electron-api.js';
import type { ApiAuthResponse } from '../../main/auth-contract.js';

const STORAGE_KEY = 'ph_ponto_admin_web_refresh_token';

function isLocalOrDevEnvironment(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
    );
  }
  return false;
}

function getApiBaseUrl(): string {
  if (
    typeof import.meta.env.VITE_API_BASE_URL === 'string' &&
    import.meta.env.VITE_API_BASE_URL.length > 0
  ) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
    ) {
      return `${protocol}//${hostname}:3000`;
    }
  }
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:3000';
  }
  return 'https://ponto-api.phmotopecas.com';
}

export interface WebAuthError extends Error {
  status?: number;
  code?: string;
}

function isAuthRevocationError(error: unknown): boolean {
  if (error instanceof Error) {
    const err = error as WebAuthError;
    if (err.status === 401 || err.status === 403) return true;
    if (err.code === 'AUTHENTICATION_REQUIRED' || err.code === 'INVALID_CREDENTIALS') return true;
    if (err.message === 'AUTHENTICATION_REQUIRED' || err.message === 'Login ou senha inválidos.') {
      return true;
    }
    if (err.message.includes('Acesso restrito')) return true;
  }
  return false;
}

async function handleApiResponse(response: Response): Promise<ApiAuthResponse> {
  if (!response.ok) {
    let errorData: { code?: string; message?: string } | null = null;
    try {
      errorData = (await response.json()) as { code?: string; message?: string };
    } catch {
      // Ignore JSON parse failure
    }

    const isAuth = response.status === 401 || errorData?.code === 'INVALID_CREDENTIALS';
    const isRate =
      response.status === 429 ||
      errorData?.code === 'RATE_LIMITED' ||
      errorData?.code === 'LOGIN_RATE_LIMITED';

    const message = isAuth
      ? 'Login ou senha inválidos.'
      : isRate
        ? 'Muitas tentativas. Aguarde alguns instantes e tente novamente.'
        : errorData?.message || 'Não foi possível entrar. Verifique os dados e tente novamente.';

    const error = new Error(message) as WebAuthError;
    error.status = response.status;
    const resolvedCode = errorData?.code || (isAuth ? 'INVALID_CREDENTIALS' : undefined);
    if (resolvedCode) {
      error.code = resolvedCode;
    }
    throw error;
  }

  return (await response.json()) as ApiAuthResponse;
}

export class WebAuthBridge {
  private refreshPromise: Promise<DesktopAuthState> | null = null;

  public async login(input: DesktopLoginInput): Promise<DesktopAuthState> {
    this.refreshPromise = null;
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login: input.login.trim(),
        password: input.password,
        deviceName: 'Navegador Web',
      }),
    });

    const data = await handleApiResponse(response);

    // In production web, restrict employees to the official Desktop client
    if (data.user.role === 'EMPLOYEE' && !isLocalOrDevEnvironment()) {
      throw new Error(
        'Acesso restrito: Funcionários devem utilizar o aplicativo Desktop para bater ponto e acessar o histórico.',
      );
    }

    // Persist refresh token (localStorage for admins, sessionStorage for employees in local web)
    try {
      if (data.user.role === 'ADMIN') {
        localStorage.setItem(STORAGE_KEY, data.refreshToken);
      } else {
        sessionStorage.setItem(STORAGE_KEY, data.refreshToken);
      }
    } catch {
      // Ignore storage errors
    }

    return {
      session: {
        accessToken: data.accessToken,
        accessTokenExpiresAt: new Date(
          Date.now() + data.accessTokenExpiresInSeconds * 1000,
        ).toISOString(),
        user: data.user,
      },
      persistence: 'ENCRYPTED',
    };
  }

  public async restore(): Promise<DesktopAuthState> {
    // If a refresh is already in-flight (e.g. StrictMode double-mount or concurrent request), share it
    if (this.refreshPromise !== null) {
      try {
        return await this.refreshPromise;
      } catch (error) {
        if (isAuthRevocationError(error)) {
          return { session: null, persistence: 'ENCRYPTED' };
        }
        throw error;
      }
    }

    const refreshToken = this.getStoredRefreshToken();
    if (!refreshToken) {
      return { session: null, persistence: 'ENCRYPTED' };
    }

    try {
      return await this.refresh();
    } catch (error) {
      if (isAuthRevocationError(error)) {
        this.clearStoredRefreshToken();
        return { session: null, persistence: 'ENCRYPTED' };
      }
      throw error;
    }
  }

  public refresh(): Promise<DesktopAuthState> {
    if (this.refreshPromise !== null) {
      return this.refreshPromise;
    }

    const refreshToken = this.getStoredRefreshToken();
    if (!refreshToken) {
      return Promise.reject(new Error('AUTHENTICATION_REQUIRED'));
    }

    const pending = this.performRefresh(refreshToken).finally(() => {
      if (this.refreshPromise === pending) {
        this.refreshPromise = null;
      }
    });

    this.refreshPromise = pending;
    return pending;
  }

  private async performRefresh(refreshToken: string): Promise<DesktopAuthState> {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await handleApiResponse(response);

      if (data.user.role === 'EMPLOYEE' && !isLocalOrDevEnvironment()) {
        this.clearStoredRefreshToken();
        throw new Error(
          'Acesso restrito: Funcionários devem utilizar o aplicativo Desktop para bater ponto.',
        );
      }

      this.setStoredRefreshToken(data.refreshToken);

      return {
        session: {
          accessToken: data.accessToken,
          accessTokenExpiresAt: new Date(
            Date.now() + data.accessTokenExpiresInSeconds * 1000,
          ).toISOString(),
          user: data.user,
        },
        persistence: 'ENCRYPTED',
      };
    } catch (error) {
      if (isAuthRevocationError(error)) {
        this.clearStoredRefreshToken();
      }
      throw error;
    }
  }

  public async logout(): Promise<DesktopLogoutState> {
    this.refreshPromise = null;
    const refreshToken = this.getStoredRefreshToken();
    this.clearStoredRefreshToken();

    if (refreshToken) {
      const baseUrl = getApiBaseUrl();
      try {
        await fetch(`${baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Ignore network errors during logout
      }
    }

    return {
      session: null,
      persistence: 'MEMORY_ONLY',
      remoteRevocation: 'CONFIRMED',
    };
  }

  private getStoredRefreshToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private setStoredRefreshToken(token: string): void {
    try {
      if (localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, token);
      } else {
        sessionStorage.setItem(STORAGE_KEY, token);
      }
    } catch {
      // Ignore
    }
  }

  private clearStoredRefreshToken(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export const webAuth = new WebAuthBridge();
