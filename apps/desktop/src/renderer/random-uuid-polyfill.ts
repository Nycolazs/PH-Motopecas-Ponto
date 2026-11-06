/**
 * `crypto.randomUUID` only exists in secure contexts (HTTPS or localhost). When the web panel
 * is opened over plain HTTP on the LAN or Tailscale, punches would fail before reaching the
 * API because their idempotency key comes from it. `getRandomValues` is available in every
 * context and is cryptographically strong, so it backs an RFC 4122 v4 fallback.
 */
if (
  typeof globalThis.crypto !== 'undefined' &&
  typeof globalThis.crypto.randomUUID !== 'function'
) {
  const crypto = globalThis.crypto;
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    writable: true,
    value: (): `${string}-${string}-${string}-${string}-${string}` => {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6]! & 0x0f) | 0x40;
      bytes[8] = (bytes[8]! & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    },
  });
}

export {};
