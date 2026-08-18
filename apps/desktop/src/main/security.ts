import { isAbsolute, relative, resolve, sep } from 'node:path';

import type { IpcMainInvokeEvent } from 'electron';

export const PACKAGED_RENDERER_ORIGIN = 'ph-ponto://app';
export const DEFAULT_DEVELOPMENT_ORIGIN = 'http://localhost:5173';

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

export function validateDevelopmentOrigin(value: string): string {
  const url = parseUrl(value);

  if (
    url === undefined ||
    url.protocol !== 'http:' ||
    url.username !== '' ||
    url.password !== '' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.port === '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('Invalid desktop development origin.');
  }

  return url.origin;
}

export function isAllowedApplicationUrl(value: string, developmentOrigin?: string): boolean {
  const url = parseUrl(value);

  if (url === undefined || url.username !== '' || url.password !== '') {
    return false;
  }

  if (
    url.protocol === 'ph-ponto:' &&
    url.hostname === 'app' &&
    url.port === '' &&
    url.search === ''
  ) {
    return true;
  }

  return developmentOrigin !== undefined && url.origin === developmentOrigin;
}

export function isTrustedIpcSender(
  event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>,
  trustedWebContentsIds: ReadonlySet<number>,
  developmentOrigin?: string,
): boolean {
  const frame = event.senderFrame;
  return (
    trustedWebContentsIds.has(event.sender.id) &&
    frame !== null &&
    frame === event.sender.mainFrame &&
    isAllowedApplicationUrl(frame.url, developmentOrigin)
  );
}

export function resolveRendererAsset(rendererRoot: string, requestUrl: string): string {
  const url = parseUrl(requestUrl);
  if (
    url === undefined ||
    url.protocol !== 'ph-ponto:' ||
    url.hostname !== 'app' ||
    url.port !== '' ||
    url.search !== ''
  ) {
    throw new Error('Untrusted renderer URL.');
  }

  const decodedPath = decodeURIComponent(url.pathname);
  if (decodedPath.includes('\0')) {
    throw new Error('Invalid renderer asset path.');
  }
  const requestedPath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const assetPath = resolve(rendererRoot, requestedPath);
  const relativePath = relative(rendererRoot, assetPath);

  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error('Renderer asset escaped its root.');
  }

  return assetPath;
}

function isAllowedHttpHost(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local')
  ) {
    return true;
  }
  const parts = hostname.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => !Number.isNaN(p) && p >= 0 && p <= 255)) {
    const p0 = parts[0];
    const p1 = parts[1];
    if (p0 === 10) return true;
    if (p0 === 192 && p1 === 168) return true;
    if (p0 === 172 && p1 !== undefined && p1 >= 16 && p1 <= 31) return true;
    if (p0 === 127) return true;
  }
  return false;
}

export function validateApiBaseUrl(value: string): string {
  const url = parseUrl(value);
  const isSecure = url?.protocol === 'https:';
  const isAllowedHttp = url?.protocol === 'http:' && isAllowedHttpHost(url.hostname);

  if (
    url === undefined ||
    (!isSecure && !isAllowedHttp) ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('Invalid API base URL.');
  }

  return url.origin;
}

export function createContentSecurityPolicy(
  apiBaseUrl: string,
  developmentOrigin?: string,
): string {
  const apiOrigin = validateApiBaseUrl(apiBaseUrl);
  const developmentConnections =
    developmentOrigin === undefined
      ? ''
      : ` ${developmentOrigin} ${developmentOrigin.replace('http:', 'ws:')}`;

  return [
    "default-src 'self'",
    developmentOrigin === undefined ? "script-src 'self'" : "script-src 'self' 'unsafe-inline'",
    developmentOrigin === undefined ? "style-src 'self'" : "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${apiOrigin}`,
    `connect-src 'self' ${apiOrigin}${developmentConnections}`,
    "font-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

export function createSecureWebPreferences(preloadPath: string): Electron.WebPreferences {
  return {
    preload: preloadPath,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: false,
  };
}
