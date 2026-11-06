import { describe, expect, it } from 'vitest';

import {
  BRAND,
  BUSINESS_TIME_ZONE,
  COMPANY_NAME,
  DISPLAY_LOCALE,
  PRODUCT_NAME,
} from '../src/index.js';

describe('product constants', () => {
  it('takes the product and company names from the brand file', () => {
    expect(PRODUCT_NAME).toBe(BRAND.productName);
    expect(COMPANY_NAME).toBe(BRAND.companyName);
    expect(PRODUCT_NAME.trim().length).toBeGreaterThan(0);
    expect(BRAND.desktop.appId).toMatch(/^[a-z0-9]+(\.[a-z0-9-]+)+$/);
    expect(BRAND.desktop.executableName).toMatch(/^[a-z0-9-]+$/);
  });

  it('uses the authoritative business timezone and display locale', () => {
    expect(BUSINESS_TIME_ZONE).toBe('America/Sao_Paulo');
    expect(DISPLAY_LOCALE).toBe('pt-BR');
  });
});
