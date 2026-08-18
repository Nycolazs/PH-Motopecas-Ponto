import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EnvironmentVariables } from '../config/environment.js';
import { UserRole } from '../generated/prisma/client.js';
import { BootstrapAdminService } from './bootstrap-admin.service.js';
import type { PrismaService } from './prisma.service.js';

describe('BootstrapAdminService', () => {
  let service: BootstrapAdminService;
  let userFindFirst: ReturnType<typeof vi.fn>;
  let userFindUnique: ReturnType<typeof vi.fn>;
  let userCreate: ReturnType<typeof vi.fn>;
  let userUpdate: ReturnType<typeof vi.fn>;
  let scheduleFindUnique: ReturnType<typeof vi.fn>;
  let scheduleCreate: ReturnType<typeof vi.fn>;
  let configGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    userFindFirst = vi.fn();
    userFindUnique = vi.fn();
    userCreate = vi.fn();
    userUpdate = vi.fn();
    scheduleFindUnique = vi.fn();
    scheduleCreate = vi.fn();

    const txMock = {
      user: {
        findFirst: userFindFirst,
        findUnique: userFindUnique,
        create: userCreate,
        update: userUpdate,
      },
      businessScheduleVersion: {
        findUnique: scheduleFindUnique,
        create: scheduleCreate,
      },
    };

    const prismaMock = {
      ...txMock,
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
    } as unknown as PrismaService;

    configGet = vi.fn((key: string) => {
      if (key === 'INITIAL_ADMIN_USERNAME') return 'admin';
      if (key === 'INITIAL_ADMIN_PASSWORD') return 'admin';
      return undefined;
    });

    const configMock = {
      get: configGet,
    } as unknown as ConfigService<EnvironmentVariables, true>;

    service = new BootstrapAdminService(prismaMock, configMock);
  });

  it('creates an admin with name "Administrador", login "admin", role ADMIN when no admin exists', async () => {
    userFindFirst.mockResolvedValue(null);
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue({
      id: 'admin-123',
      name: 'Administrador',
      login: 'admin',
      role: UserRole.ADMIN,
      isActive: true,
    });
    scheduleFindUnique.mockResolvedValue(null);
    scheduleCreate.mockResolvedValue({ id: 'sched-123' });

    const result = await service.ensureBootstrapAdminAndSchedule();

    expect(result.adminCreated).toBe(true);
    expect(result.scheduleCreated).toBe(true);
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Administrador',
          login: 'admin',
          normalizedLogin: 'admin',
          role: UserRole.ADMIN,
          isActive: true,
        }),
      }),
    );
    expect(scheduleCreate).toHaveBeenCalled();
  });

  it('does not recreate admin if active admin already exists', async () => {
    userFindFirst.mockResolvedValue({
      id: 'existing-admin',
      role: UserRole.ADMIN,
      isActive: true,
    });
    scheduleFindUnique.mockResolvedValue({ id: 'existing-sched' });

    const result = await service.ensureBootstrapAdminAndSchedule();

    expect(result.adminCreated).toBe(false);
    expect(result.scheduleCreated).toBe(false);
    expect(userCreate).not.toHaveBeenCalled();
    expect(scheduleCreate).not.toHaveBeenCalled();
  });
});
