import { type Provider } from '@nestjs/common';

import { AUTH_CLOCK } from './auth.constants.js';

export type AuthClock = () => Date;

export const authClockProvider: Provider<AuthClock> = {
  provide: AUTH_CLOCK,
  useValue: (): Date => new Date(),
};
