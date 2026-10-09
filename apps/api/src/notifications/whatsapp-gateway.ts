import { z } from 'zod';

/** Session name used by PH-Ponto inside its own OpenWA instance. */
export const WHATSAPP_SESSION_NAME = 'ph-ponto';

const sessionStatusSchema = z.enum([
  'created',
  'initializing',
  'qr_ready',
  'authenticating',
  'ready',
  'disconnected',
  'action_required',
  'failed',
]);

const sessionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: sessionStatusSchema,
  phone: z.string().nullable().optional(),
  connectedAt: z.string().nullable().optional(),
  engineLoaded: z.boolean().optional(),
});

const sessionsSchema = z.array(sessionSchema);
const qrSchema = z.object({ qrCode: z.string().startsWith('data:image/') });
const sentMessageSchema = z.object({ messageId: z.string().min(1) });

export type WhatsappSession = z.infer<typeof sessionSchema>;

export type WhatsappConnectionState =
  | 'NOT_CONFIGURED'
  | 'UNAVAILABLE'
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'WAITING_QR'
  | 'CONNECTED'
  | 'ERROR';

export interface WhatsappStatus {
  state: WhatsappConnectionState;
  phone: string | null;
  connectedAt: string | null;
}

export class WhatsappGatewayError extends Error {
  public constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'WhatsappGatewayError';
  }
}

export function toConnectionState(session: WhatsappSession | null): WhatsappConnectionState {
  if (session === null) return 'DISCONNECTED';
  switch (session.status) {
    case 'ready':
      return session.engineLoaded === false ? 'CONNECTING' : 'CONNECTED';
    case 'qr_ready':
      return 'WAITING_QR';
    case 'initializing':
    case 'authenticating':
    case 'created':
      return 'CONNECTING';
    case 'disconnected':
      return 'DISCONNECTED';
    default:
      return 'ERROR';
  }
}

export interface WhatsappGatewayConfig {
  baseUrl: string | undefined;
  apiKey: string | undefined;
  timeoutMs?: number;
}

/**
 * Minimal OpenWA REST client. PH-Ponto only needs one session, a QR code to pair
 * the store's WhatsApp number, and plain text delivery.
 */
export class WhatsappGateway {
  private readonly origin: string | null;
  private readonly apiKey: string | null;
  private readonly timeoutMs: number;

  public constructor(config: WhatsappGatewayConfig) {
    this.origin = config.baseUrl ? new URL(config.baseUrl).origin : null;
    this.apiKey = config.apiKey && config.apiKey.length > 0 ? config.apiKey : null;
    this.timeoutMs = config.timeoutMs ?? 20_000;
  }

  public get isConfigured(): boolean {
    return this.origin !== null && this.apiKey !== null;
  }

  public async findSession(): Promise<WhatsappSession | null> {
    const sessions = await this.request('GET', '/api/sessions?limit=1000&offset=0', sessionsSchema);
    return sessions.find((session) => session.name === WHATSAPP_SESSION_NAME) ?? null;
  }

  public async status(): Promise<WhatsappStatus> {
    if (!this.isConfigured) return { state: 'NOT_CONFIGURED', phone: null, connectedAt: null };
    try {
      const session = await this.findSession();
      return {
        state: toConnectionState(session),
        phone: session?.phone ?? null,
        connectedAt: session?.connectedAt ?? null,
      };
    } catch {
      return { state: 'UNAVAILABLE', phone: null, connectedAt: null };
    }
  }

  /** Creates the session when needed and starts it so a QR code becomes available. */
  public async connect(): Promise<WhatsappSession> {
    let session = await this.findSession();
    if (session === null) {
      session = await this.request('POST', '/api/sessions', sessionSchema, {
        name: WHATSAPP_SESSION_NAME,
      });
    }
    if (session.status === 'ready' || session.status === 'qr_ready') return session;
    return this.request('POST', `/api/sessions/${session.id}/start`, sessionSchema);
  }

  public async qrCode(): Promise<string | null> {
    const session = await this.findSession();
    if (session === null || session.status !== 'qr_ready') return null;
    const qr = await this.request('GET', `/api/sessions/${session.id}/qr`, qrSchema);
    return qr.qrCode;
  }

  /** Unlinks the WhatsApp number by deleting the session (a new QR is required afterwards). */
  public async disconnect(): Promise<void> {
    const session = await this.findSession();
    if (session === null) return;
    await this.request('DELETE', `/api/sessions/${session.id}`, z.unknown());
  }

  public async sendText(phone: string, text: string): Promise<string> {
    const session = await this.findSession();
    if (session === null || toConnectionState(session) !== 'CONNECTED') {
      throw new WhatsappGatewayError('WhatsApp não está conectado.', true);
    }
    const result = await this.request(
      'POST',
      `/api/sessions/${session.id}/messages/send-text`,
      sentMessageSchema,
      { chatId: `${phone}@c.us`, text },
    );
    return result.messageId;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<T> {
    if (this.origin === null || this.apiKey === null) {
      throw new WhatsappGatewayError('Integração de WhatsApp não configurada no servidor.', false);
    }
    let response: Response;
    try {
      response = await fetch(`${this.origin}${path}`, {
        method,
        headers: {
          'X-API-Key': this.apiKey,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new WhatsappGatewayError('Serviço de WhatsApp indisponível.', true);
    }
    if (!response.ok) {
      await response.body?.cancel();
      const retryable = response.status >= 500 || response.status === 429;
      throw new WhatsappGatewayError(
        response.status === 401 || response.status === 403
          ? 'Chave de acesso do serviço de WhatsApp recusada.'
          : `Serviço de WhatsApp respondeu com erro ${response.status}.`,
        retryable,
      );
    }
    if (response.status === 204) return schema.parse(undefined);
    const text = await response.text();
    let value: unknown = undefined;
    if (text.length > 0) {
      try {
        value = JSON.parse(text);
      } catch {
        throw new WhatsappGatewayError('Resposta inválida do serviço de WhatsApp.', true);
      }
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new WhatsappGatewayError('Resposta inesperada do serviço de WhatsApp.', true);
    }
    return parsed.data;
  }
}
