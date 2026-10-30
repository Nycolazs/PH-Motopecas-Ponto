import { describe, expect, it } from 'vitest';

import {
  decodeAttachmentBase64,
  sanitizeAttachmentFileName,
} from './absence-justifications.service.js';
import { detectAttachmentMimeType } from './justification-attachment-storage.service.js';

describe('atestado attachment input', () => {
  it('keeps only a safe file name with the extension of the real type', () => {
    expect(sanitizeAttachmentFileName('IMG_2041.HEIC', 'image/jpeg')).toBe('IMG_2041.jpg');
    expect(sanitizeAttachmentFileName('C:\\Users\\ana\\atestado maio.pdf', 'application/pdf')).toBe(
      'atestado maio.pdf',
    );
    expect(sanitizeAttachmentFileName('../../.env', 'image/png')).toBe('atestado.png');
    expect(sanitizeAttachmentFileName('a"b<c>\u0000d.webp', 'image/webp')).toBe('a b c d.webp');
  });

  it('accepts strict Base64 or data URLs only', () => {
    expect(decodeAttachmentBase64('data:image/png;base64,QUJD')?.toString()).toBe('ABC');
    expect(decodeAttachmentBase64('QUJD\nRA==')?.toString()).toBe('ABCD');
    expect(decodeAttachmentBase64('QUJ')).toBeNull();
    expect(decodeAttachmentBase64('não base64')).toBeNull();
  });

  it('detects the type from the content', () => {
    expect(detectAttachmentMimeType(Buffer.from('%PDF-1.7 ...'))).toBe('application/pdf');
    expect(
      detectAttachmentMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])),
    ).toBe('image/jpeg');
    expect(detectAttachmentMimeType(Buffer.from('<html>atestado</html>'))).toBeNull();
  });
});
