import { describe, expect, it } from 'vitest';

import { renumberSectionTitles } from './document-templates.service.js';

describe('renumberSectionTitles', () => {
  it('renumbers numbered sections sequentially when optional sections are omitted', () => {
    const html = [
      '<h3 class="section-title">1. Motivo</h3>',
      '<h3 class="section-title">3. Orientações</h3>',
      '<h3 class="section-title">Testemunhas</h3>',
      '<h3 class="section-title">4. Notificação</h3>',
    ].join('');

    expect(renumberSectionTitles(html)).toBe(
      [
        '<h3 class="section-title">1. Motivo</h3>',
        '<h3 class="section-title">2. Orientações</h3>',
        '<h3 class="section-title">Testemunhas</h3>',
        '<h3 class="section-title">3. Notificação</h3>',
      ].join(''),
    );
  });

  it('leaves documents without numbered sections untouched', () => {
    const html = '<h3 class="section-title">Nossa Missão</h3><p>1. texto</p>';
    expect(renumberSectionTitles(html)).toBe(html);
  });
});
