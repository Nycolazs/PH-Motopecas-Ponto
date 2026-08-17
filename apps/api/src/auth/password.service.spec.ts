import { hash as argonHash, argon2id } from 'argon2';
import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies passwords with the pinned Argon2id policy', async () => {
    const passwordHash = await service.hash('Uma senha longa e exclusiva!');

    expect(passwordHash).toMatch(/^\$argon2id\$v=19\$/);
    expect(passwordHash).toContain('m=65536');
    expect(passwordHash).toContain('t=3');
    expect(passwordHash).toContain('p=1');
    await expect(service.verify('Uma senha longa e exclusiva!', passwordHash)).resolves.toEqual({
      valid: true,
      needsRehash: false,
    });
    await expect(service.verify('senha incorreta', passwordHash)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });

  it('requests a rehash when a valid legacy policy is weaker', async () => {
    const legacyHash = await argonHash('Senha antiga ainda válida', {
      type: argon2id,
      memoryCost: 8_192,
      timeCost: 2,
      parallelism: 1,
    });

    await expect(service.verify('Senha antiga ainda válida', legacyHash)).resolves.toEqual({
      valid: true,
      needsRehash: true,
    });
  });

  it('performs a safe verification for an unknown login', async () => {
    await expect(service.verifyUnknownLogin('qualquer senha')).resolves.toBeUndefined();
  });
});
