import type {
  DesktopAuthSession,
  DesktopAuthState,
  DesktopLoginInput,
  DesktopLogoutState,
} from '../shared/electron-api.js';
import type { AuthApiClient } from './auth-api-client.js';
import { AuthContractError, type ApiAuthResponse } from './auth-contract.js';
import type { RefreshTokenVault } from './refresh-token-vault.js';

export class DesktopAuthSessionService {
  private currentSession: DesktopAuthSession | undefined;
  private operationTail: Promise<void> = Promise.resolve();
  private refreshInFlight: Promise<DesktopAuthState> | undefined;

  public constructor(
    private readonly api: AuthApiClient,
    private readonly vault: RefreshTokenVault,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public login(input: DesktopLoginInput): Promise<DesktopAuthState> {
    return this.runExclusive(async () => {
      const response = await this.api.login(input);
      return this.acceptRotatedSession(response);
    });
  }

  public restore(): Promise<DesktopAuthState> {
    return this.refresh().catch((error: unknown) => {
      if (isAuthenticationRequired(error)) return this.emptyState();
      throw error;
    });
  }

  public refresh(): Promise<DesktopAuthState> {
    if (this.refreshInFlight !== undefined) return this.refreshInFlight;

    const operation = this.runExclusive(() => this.refreshInternal());
    const singleFlight = operation.finally(() => {
      if (this.refreshInFlight === singleFlight) this.refreshInFlight = undefined;
    });
    this.refreshInFlight = singleFlight;
    return singleFlight;
  }

  public logout(): Promise<DesktopLogoutState> {
    return this.runExclusive(async () => {
      let remoteRevocation: DesktopLogoutState['remoteRevocation'] = 'CONFIRMED';

      try {
        let accessToken = this.currentSession?.accessToken;
        const accessTokenExpired =
          this.currentSession !== undefined &&
          Date.parse(this.currentSession.accessTokenExpiresAt) <= this.now().getTime();
        let refreshedForLogout = false;

        if (accessToken === undefined || accessTokenExpired) {
          const refreshed = await this.refreshForLogout();
          accessToken = refreshed.accessToken;
          refreshedForLogout = refreshed.accessToken !== undefined;
          remoteRevocation = refreshed.remoteRevocation;
        }

        if (accessToken !== undefined && remoteRevocation === 'CONFIRMED') {
          try {
            await this.api.logout(accessToken);
          } catch (error) {
            if (isAuthenticationRequired(error) && !refreshedForLogout) {
              const refreshed = await this.refreshForLogout();
              if (
                refreshed.accessToken !== undefined &&
                refreshed.remoteRevocation === 'CONFIRMED'
              ) {
                try {
                  await this.api.logout(refreshed.accessToken);
                } catch (retryError) {
                  if (!isAuthenticationRequired(retryError)) {
                    remoteRevocation = 'UNCONFIRMED';
                  }
                }
              } else {
                remoteRevocation = refreshed.remoteRevocation;
              }
            } else if (!isAuthenticationRequired(error)) {
              remoteRevocation = 'UNCONFIRMED';
            }
          }
        }
      } finally {
        this.currentSession = undefined;
        await this.vault.clear();
      }

      return {
        session: null,
        persistence: this.vault.persistence(),
        remoteRevocation,
      };
    });
  }

  private async refreshForLogout(): Promise<{
    accessToken: string | undefined;
    remoteRevocation: DesktopLogoutState['remoteRevocation'];
  }> {
    const refreshToken = await this.vault.load();
    if (refreshToken === undefined) {
      return {
        accessToken: undefined,
        remoteRevocation: this.currentSession === undefined ? 'CONFIRMED' : 'UNCONFIRMED',
      };
    }

    try {
      const response = await this.api.refresh(refreshToken);
      const state = await this.acceptRotatedSession(response);
      return { accessToken: state.session?.accessToken, remoteRevocation: 'CONFIRMED' };
    } catch (error) {
      return {
        accessToken: undefined,
        remoteRevocation: isAuthenticationRequired(error) ? 'CONFIRMED' : 'UNCONFIRMED',
      };
    }
  }

  private async refreshInternal(): Promise<DesktopAuthState> {
    const refreshToken = await this.vault.load();
    if (refreshToken === undefined) {
      this.currentSession = undefined;
      return this.emptyState();
    }

    try {
      const response = await this.api.refresh(refreshToken);
      return await this.acceptRotatedSession(response);
    } catch (error) {
      this.currentSession = undefined;
      await this.vault.clear();
      throw error;
    }
  }

  private async acceptRotatedSession(response: ApiAuthResponse): Promise<DesktopAuthState> {
    if (response.user.role === 'ADMIN') {
      this.currentSession = undefined;
      await this.vault.clear();
      throw new AuthContractError({
        code: 'ROLE_FORBIDDEN_DESKTOP',
        message:
          'Acesso restrito: Administradores devem acessar o painel administrativo pelo navegador web.',
        status: 403,
      });
    }

    const persistence = await this.vault.store(response.refreshToken);
    const session: DesktopAuthSession = {
      accessToken: response.accessToken,
      accessTokenExpiresAt: new Date(
        this.now().getTime() + response.accessTokenExpiresInSeconds * 1_000,
      ).toISOString(),
      user: response.user,
    };
    this.currentSession = session;
    return { session, persistence };
  }

  private emptyState(): DesktopAuthState {
    return { session: null, persistence: this.vault.persistence() };
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function isAuthenticationRequired(error: unknown): boolean {
  return (
    error instanceof AuthContractError &&
    (error.safe.status === 401 || error.safe.code === 'AUTHENTICATION_REQUIRED')
  );
}
