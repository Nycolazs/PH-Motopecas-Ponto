import { Injectable } from '@nestjs/common';
import { argon2id, hash, needsRehash, verify } from 'argon2';

const ARGON2ID_POLICY = Object.freeze({
  type: argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
});

// This value protects unknown-login verification timing. It is not a credential.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=1$UEgtUG9udG8tZHVtbXktc2FsdA$gDkVDLfB6NC7a52ZYbOJLI6LaPVgIEvWgSgZ8M0bjqg';

export interface PasswordVerification {
  valid: boolean;
  needsRehash: boolean;
}

@Injectable()
export class PasswordService {
  public async hash(password: string): Promise<string> {
    return hash(password, ARGON2ID_POLICY);
  }

  public async verify(password: string, passwordHash: string): Promise<PasswordVerification> {
    try {
      const valid = await verify(passwordHash, password);
      return {
        valid,
        needsRehash: valid && needsRehash(passwordHash, ARGON2ID_POLICY),
      };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  public async verifyUnknownLogin(password: string): Promise<void> {
    await this.verify(password, DUMMY_PASSWORD_HASH);
  }
}
