import { describe, expect, it } from 'vitest';

import { BUSINESS_TIME_ZONE, COMPANY_NAME, DISPLAY_LOCALE, PRODUCT_NAME } from '../src/index.js';

describe('product constants', () => {
  it('uses the official product and company names', () => {
    expect(PRODUCT_NAME).toBe('PH-Ponto');
    expect(COMPANY_NAME).toBe('PH Motopeças');
  });

  it('uses the authoritative business timezone and display locale', () => {
    expect(BUSINESS_TIME_ZONE).toBe('America/Fortaleza');
    expect(DISPLAY_LOCALE).toBe('pt-BR');
  });
});
