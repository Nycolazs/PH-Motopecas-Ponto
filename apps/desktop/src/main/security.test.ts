// @vitest-environment node

import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createContentSecurityPolicy,
  createSecureWebPreferences,
  isAllowedApplicationUrl,
  isTrustedIpcSender,
  resolveRendererAsset,
  validateApiBaseUrl,
  validateDevelopmentOrigin,
} from './security.js';

describe('Electron security policy', () => {
  it('accepts only the exact packaged and configured development origins', () => {
    const developmentOrigin = validateDevelopmentOrigin('http://localhost:5173');

    expect(isAllowedApplicationUrl('ph-ponto://app/index.html')).toBe(true);
    expect(isAllowedApplicationUrl('ph-ponto://app:123/index.html')).toBe(false);
    expect(isAllowedApplicationUrl('ph-ponto://app/index.html?remote=1')).toBe(false);
    expect(isAllowedApplicationUrl('http://localhost:5173/#/', developmentOrigin)).toBe(true);
    expect(isAllowedApplicationUrl('http://localhost.evil.test:5173', developmentOrigin)).toBe(
      false,
    );
    expect(isAllowedApplicationUrl('http://localhost:5173.evil.test', developmentOrigin)).toBe(
      false,
    );
    expect(isAllowedApplicationUrl('javascript:alert(1)', developmentOrigin)).toBe(false);
    expect(isAllowedApplicationUrl('data:text/html,unsafe', developmentOrigin)).toBe(false);
    expect(isAllowedApplicationUrl('file:///tmp/unsafe', developmentOrigin)).toBe(false);
  });

  it('rejects non-loopback or credentialed development origins', () => {
    expect(() => validateDevelopmentOrigin('https://example.com')).toThrow();
    expect(() => validateDevelopmentOrigin('http://user:pass@localhost:5173')).toThrow();
    expect(() => validateDevelopmentOrigin('http://localhost')).toThrow();
  });

  it('keeps packaged asset resolution inside the renderer root', () => {
    const rendererRoot = resolve('/application', 'renderer');

    expect(resolveRendererAsset(rendererRoot, 'ph-ponto://app/assets/app.js')).toBe(
      join(rendererRoot, 'assets', 'app.js'),
    );
    expect(() =>
      resolveRendererAsset(rendererRoot, 'ph-ponto://app/%2e%2e%2fsecrets.txt'),
    ).toThrow();
    expect(() => resolveRendererAsset(rendererRoot, 'https://example.com/app.js')).toThrow();
    expect(() => resolveRendererAsset(rendererRoot, 'ph-ponto://app/app.js?remote=1')).toThrow();
    expect(() => resolveRendererAsset(rendererRoot, 'ph-ponto://app/%00app.js')).toThrow();
  });

  it('accepts HTTPS, loopback, LAN or mDNS API origins without credentials or paths', () => {
    expect(validateApiBaseUrl('https://api.example.com')).toBe('https://api.example.com');
    expect(validateApiBaseUrl('http://localhost:3000')).toBe('http://localhost:3000');
    expect(validateApiBaseUrl('http://192.168.1.150:3000')).toBe('http://192.168.1.150:3000');
    expect(validateApiBaseUrl('http://raspberrypi.local:3000')).toBe(
      'http://raspberrypi.local:3000',
    );
    expect(() => validateApiBaseUrl('file:///tmp/api')).toThrow();
    expect(() => validateApiBaseUrl('https://user:secret@api.example.com')).toThrow();
    expect(() => validateApiBaseUrl('https://api.example.com/v1')).toThrow();
    expect(() => validateApiBaseUrl('http://insecure-public-domain.com')).toThrow();
  });

  it('requires a registered top-level webContents and exact app origin for IPC', () => {
    const mainFrame = { url: 'ph-ponto://app/index.html' };
    const sender = { id: 42, mainFrame };
    const trustedIds = new Set([42]);

    expect(isTrustedIpcSender({ sender, senderFrame: mainFrame } as never, trustedIds)).toBe(true);
    expect(
      isTrustedIpcSender(
        { sender, senderFrame: { url: 'ph-ponto://app/frame.html' } } as never,
        trustedIds,
      ),
    ).toBe(false);
    expect(isTrustedIpcSender({ sender, senderFrame: mainFrame } as never, new Set([7]))).toBe(
      false,
    );
    expect(
      isTrustedIpcSender(
        {
          sender: { id: 42, mainFrame: { url: 'https://attacker.example' } },
          senderFrame: { url: 'https://attacker.example' },
        } as never,
        trustedIds,
      ),
    ).toBe(false);
  });

  it('returns mandatory BrowserWindow security preferences', () => {
    expect(createSecureWebPreferences('/application/preload.cjs')).toMatchObject({
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    });
  });

  it('keeps the production CSP free from unsafe directives', () => {
    const policy = createContentSecurityPolicy('https://api.example.com');

    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain('connect-src');
  });

  it('allows only the Vite inline preamble in the loopback development policy', () => {
    const policy = createContentSecurityPolicy('http://localhost:3000', 'http://localhost:5173');

    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain('unsafe-eval');
  });
});
