import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type { CulturePayloadDto } from '@ph-ponto/shared';
import type { Company } from '../generated/prisma/client.js';

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateBR(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

@Injectable()
export class DocumentTemplatesService {
  private readonly logger = new Logger(DocumentTemplatesService.name);
  private logoBase64: string | null = null;

  public constructor() {
    void this.loadLogo();
  }

  private async loadLogo(): Promise<void> {
    try {
      // Look for the logo in the repository assets
      const possiblePaths = [
        resolve(process.cwd(), 'apps/desktop/src/renderer/assets/phmotos-logo.png'),
        resolve(process.cwd(), '../desktop/src/renderer/assets/phmotos-logo.png'),
      ];

      for (const p of possiblePaths) {
        try {
          const buf = await readFile(p);
          this.logoBase64 = `data:image/png;base64,${buf.toString('base64')}`;
          break;
        } catch {
          // Try next path
        }
      }
    } catch (err) {
      this.logger.warn('Could not load PH Motopeças logo for templates:', err);
    }
  }

  public renderCultureDocument(
    company: Company,
    payload: CulturePayloadDto,
    versionNumber: number,
    publishedAt: Date = new Date(),
  ): string {
    const formattedDate = formatDateBR(publishedAt);
    const logoHtml = this.logoBase64
      ? `<img src="${this.logoBase64}" alt="Logo PH Motopeças" class="logo" />`
      : `<div class="logo-fallback">${escapeHtml(company.tradeName)}</div>`;

    const addressParts = [
      company.addressStreet
        ? `${company.addressStreet}${company.addressNumber ? `, ${company.addressNumber}` : ''}`
        : null,
      company.addressNeighborhood,
      company.addressCity && company.addressState
        ? `${company.addressCity} - ${company.addressState}`
        : null,
      company.addressPostalCode ? `CEP: ${company.addressPostalCode}` : null,
    ].filter(Boolean);

    const addressString = addressParts.join(' • ');

    const valuesHtml = payload.values
      .map(
        (val, idx) => `
        <div class="value-item">
          <div class="value-number">${idx + 1}</div>
          <div class="value-content">
            <h4 class="value-title">${escapeHtml(val.title)}</h4>
            <p class="value-desc">${escapeHtml(val.description)}</p>
          </div>
        </div>
      `,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Cultura Organizacional - ${escapeHtml(company.tradeName)}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 20mm 15mm;
      @bottom-center {
        content: "Página " counter(page) " de " counter(pages);
        font-size: 8pt;
        color: #64748b;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.5;
      font-size: 10pt;
      background: #ffffff;
      padding: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header-info {
      text-align: right;
    }
    .header-company-name {
      font-size: 12pt;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
    }
    .header-details {
      font-size: 8pt;
      color: #475569;
      margin-top: 2px;
    }
    .logo {
      max-height: 48px;
      max-width: 180px;
      object-fit: contain;
    }
    .logo-fallback {
      font-size: 14pt;
      font-weight: 900;
      color: #1e3a8a;
      letter-spacing: -0.5px;
    }
    .document-title-block {
      text-align: center;
      margin-bottom: 24px;
      padding: 12px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .document-title {
      font-size: 14pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.2px;
      text-transform: uppercase;
    }
    .document-meta {
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 4px;
      font-weight: 500;
    }
    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 11pt;
      font-weight: 700;
      color: #1e3a8a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #2563eb;
      border-radius: 4px;
      padding: 10px 14px;
      font-size: 9.5pt;
      color: #1e293b;
      line-height: 1.6;
    }
    .values-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 6px;
    }
    .value-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      page-break-inside: avoid;
    }
    .value-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      background: #1e3a8a;
      color: #ffffff;
      font-weight: 800;
      font-size: 8pt;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .value-content {
      flex: 1;
    }
    .value-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .value-desc {
      font-size: 8.5pt;
      color: #475569;
      line-height: 1.45;
    }
    .motto-box {
      text-align: center;
      padding: 14px;
      background: #eff6ff;
      border: 1px dashed #3b82f6;
      border-radius: 6px;
      margin-top: 16px;
      page-break-inside: avoid;
    }
    .motto-label {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1d4ed8;
      margin-bottom: 4px;
    }
    .motto-text {
      font-size: 11pt;
      font-weight: 800;
      font-style: italic;
      color: #1e3a8a;
    }
    .footer-signatures {
      margin-top: 36px;
      display: flex;
      justify-content: space-around;
      page-break-inside: avoid;
    }
    .signature-block {
      text-align: center;
      width: 200px;
    }
    .signature-line {
      border-top: 1px solid #475569;
      margin-bottom: 6px;
    }
    .signature-name {
      font-size: 8.5pt;
      font-weight: 700;
      color: #0f172a;
    }
    .signature-role {
      font-size: 7.5pt;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>${logoHtml}</div>
    <div class="header-info">
      <div class="header-company-name">${escapeHtml(company.legalName)}</div>
      <div class="header-details">CNPJ: ${escapeHtml(company.cnpj)}</div>
      ${addressString ? `<div class="header-details">${escapeHtml(addressString)}</div>` : ''}
    </div>
  </div>

  <div class="document-title-block">
    <h1 class="document-title">Cultura Organizacional e Princípios</h1>
    <div class="document-meta">Versão ${versionNumber} • Publicado em ${formattedDate}</div>
  </div>

  <div class="section">
    <h3 class="section-title">Nossa Missão</h3>
    <div class="section-box">${escapeHtml(payload.mission)}</div>
  </div>

  <div class="section">
    <h3 class="section-title">Nossa Visão</h3>
    <div class="section-box">${escapeHtml(payload.vision)}</div>
  </div>

  <div class="section">
    <h3 class="section-title">Nossos Valores</h3>
    <div class="values-container">
      ${valuesHtml}
    </div>
  </div>

  ${
    payload.motto
      ? `
  <div class="motto-box">
    <div class="motto-label">Lema Institucional</div>
    <div class="motto-text">"${escapeHtml(payload.motto)}"</div>
  </div>
  `
      : ''
  }

  <div class="footer-signatures">
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">${escapeHtml(company.primaryContactName ?? 'Diretoria Executiva')}</div>
      <div class="signature-role">Diretoria • ${escapeHtml(company.tradeName)}</div>
    </div>
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">Gestão de Recursos Humanos</div>
      <div class="signature-role">Departamento de Pessoal</div>
    </div>
  </div>
</body>
</html>`;
  }
}
