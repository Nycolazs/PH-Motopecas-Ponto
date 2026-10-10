/** Development-only key, rejected in production by the environment validation. */
export const DEVELOPMENT_DOCUMENTS_ENCRYPTION_KEY = Buffer.from(
  'development-documents-key-32byte',
  'utf8',
).toString('base64');

const HEX_KEY = /^[0-9a-fA-F]{64}$/;
const BASE64_KEY = /^[A-Za-z0-9+/]{43}=$/;

/**
 * Decodes the AES-256 key used to encrypt stored PDFs. Accepts 64 hex characters
 * (`openssl rand -hex 32`) or base64 for 32 bytes (`openssl rand -base64 32`).
 */
export function decodeDocumentsEncryptionKey(value: string): Buffer {
  const trimmed = value.trim();
  const key = HEX_KEY.test(trimmed)
    ? Buffer.from(trimmed, 'hex')
    : BASE64_KEY.test(trimmed)
      ? Buffer.from(trimmed, 'base64')
      : null;
  if (key === null || key.length !== 32) {
    throw new RangeError('DOCUMENTS_ENCRYPTION_KEY must encode exactly 32 bytes (hex or base64).');
  }
  return key;
}

export function isValidDocumentsEncryptionKey(value: string): boolean {
  try {
    decodeDocumentsEncryptionKey(value);
    return true;
  } catch {
    return false;
  }
}
