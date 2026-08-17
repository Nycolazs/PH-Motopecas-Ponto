import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { AvatarsService } from './avatars.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { EnvironmentVariables } from '../config/environment.js';
import type { PrismaService } from '../database/prisma.service.js';

describe('AvatarsService', () => {
  const mockConfigService = {
    get: vi.fn().mockReturnValue('/tmp/ph-ponto-test-uploads'),
  } as unknown as ConfigService<EnvironmentVariables, true>;

  const mockAuditService = {
    record: vi.fn().mockResolvedValue('audit-1'),
  } as unknown as AuditService;

  const mockPrismaService = {} as unknown as PrismaService;

  const sample1x1Png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('rejects upload from non-admin actor targeting different user', async () => {
    const service = new AvatarsService(mockPrismaService, mockAuditService, mockConfigService);

    await expect(
      service.upload(
        { id: 'user-1', name: 'User 1', login: 'user1', role: 'EMPLOYEE' },
        'user-2',
        { dataBase64: sample1x1Png, mimeType: 'image/png' },
        { requestId: 'r-1', ipHash: 'ip', userAgent: 'ua' },
      ),
    ).rejects.toThrow('Você não tem permissão para alterar este avatar.');
  });

  it('rejects invalid image content', async () => {
    const service = new AvatarsService(mockPrismaService, mockAuditService, mockConfigService);

    await expect(
      service.upload(
        { id: 'admin-1', name: 'Admin', login: 'admin', role: 'ADMIN' },
        'user-1',
        { dataBase64: Buffer.from('not an image').toString('base64'), mimeType: 'image/png' },
        { requestId: 'r-1', ipHash: 'ip', userAgent: 'ua' },
      ),
    ).rejects.toThrow('O formato do arquivo é inválido. Utilize JPEG, PNG ou WebP.');
  });
});
