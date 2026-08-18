import type {
  DesktopAuthState,
  DesktopLoginInput,
  DesktopLogoutState,
} from '../../shared/electron-api.js';
import type { ApiAuthResponse } from '../../main/auth-contract.js';

const STORAGE_KEY = 'ph_ponto_admin_web_refresh_token';

function getApiBaseUrl(): string {
  if (
    typeof import.meta.env.VITE_API_BASE_URL === 'string' &&
    import.meta.env.VITE_API_BASE_URL.length > 0
  ) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '0.0.0.0')
  ) {
    return 'http://127.0.0.1:3000';
  }
  return 'https://phmotopecas-api.yacacode.com';
}

async function handleApiResponse(response: Response): Promise<ApiAuthResponse> {
  if (!response.ok) {
    let errorData: { code?: string; message?: string } | null = null;
    try {
      errorData = (await response.json()) as { code?: string; message?: string };
    } catch {
      // Ignore JSON parse failure
    }

    if (response.status === 401 || errorData?.code === 'INVALID_CREDENTIALS') {
      throw new Error('Login ou senha inválidos.');
    }
    if (
      response.status === 429 ||
      errorData?.code === 'RATE_LIMITED' ||
      errorData?.code === 'LOGIN_RATE_LIMITED'
    ) {
      throw new Error('Muitas tentativas. Aguarde alguns instantes e tente novamente.');
    }
    if (errorData?.message) {
      throw new Error(errorData.message);
    }
    throw new Error('Não foi possível entrar. Verifique os dados e tente novamente.');
  }

  return (await response.json()) as ApiAuthResponse;
}

export class WebAuthBridge {
  public async login(input: DesktopLoginInput): Promise<DesktopAuthState> {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login: input.login.trim(),
        password: input.password,
        deviceName: 'Navegador Web (Admin)',
      }),
    });

    const data = await handleApiResponse(response);

    // Rule: Web interface is ADMIN ONLY.
    if (data.user.role === 'EMPLOYEE') {
      throw new Error(
        'Acesso restrito: Funcionários devem utilizar o aplicativo Desktop para bater ponto e acessar o histórico.',
      );
    }

    // Admin sessions are persisted across browser sessions
    try {
      localStorage.setItem(STORAGE_KEY, data.refreshToken);
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
    const refreshToken = this.getStoredRefreshToken();
    if (!refreshToken) {
      return { session: null, persistence: 'ENCRYPTED' };
    }

    try {
      return await this.refresh();
    } catch {
      this.clearStoredRefreshToken();
      return { session: null, persistence: 'ENCRYPTED' };
    }
  }

  public async refresh(): Promise<DesktopAuthState> {
    const refreshToken = this.getStoredRefreshToken();
    if (!refreshToken) {
      throw new Error('AUTHENTICATION_REQUIRED');
    }

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await handleApiResponse(response);

    if (data.user.role === 'EMPLOYEE') {
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
  }

  public async logout(): Promise<DesktopLogoutState> {
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
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private setStoredRefreshToken(token: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, token);
    } catch {
      // Ignore
    }
  }

  private clearStoredRefreshToken(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export const webAuth = new WebAuthBridge();
