import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type {
  AcknowledgmentRegulationPayloadDto,
  AcknowledgmentRolePayloadDto,
  CulturePayloadDto,
  DisciplineSuspensionPayloadDto,
  DisciplineVerbalPayloadDto,
  DisciplineWrittenPayloadDto,
  InterviewPayloadDto,
  RegulationPayloadDto,
  RoleMapPayloadDto,
} from '@ph-ponto/shared';
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

function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(`${date}T12:00:00Z`) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
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

  private getBaseStyles(): string {
    return `
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
    .footer-signatures {
      margin-top: 36px;
      display: flex;
      justify-content: space-around;
      page-break-inside: avoid;
    }
    .signature-block {
      text-align: center;
      width: 220px;
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
    ul.bullet-list {
      list-style-type: square;
      margin-left: 20px;
      margin-top: 6px;
    }
    ul.bullet-list li {
      margin-bottom: 4px;
      font-size: 9.5pt;
      color: #1e293b;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      font-size: 8.5pt;
      text-align: left;
    }
    table.data-table th {
      background-color: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
    }
    `;
  }

  private buildHeaderHtml(company: Company): string {
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

    return `
    <div class="header">
      <div>${logoHtml}</div>
      <div class="header-info">
        <div class="header-company-name">${escapeHtml(company.legalName)}</div>
        <div class="header-details">CNPJ: ${escapeHtml(company.cnpj)}</div>
        ${addressString ? `<div class="header-details">${escapeHtml(addressString)}</div>` : ''}
      </div>
    </div>`;
  }

  public renderCultureDocument(
    company: Company,
    payload: CulturePayloadDto,
    versionNumber: number,
    publishedAt: Date = new Date(),
  ): string {
    const formattedDate = formatDateBR(publishedAt);

    const valuesHtml = payload.values
      .map(
        (val, idx) => `
        <div style="display: flex; align-items: flex-start; gap: 12px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px; page-break-inside: avoid;">
          <div style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: #1e3a8a; color: #ffffff; font-weight: 800; font-size: 8pt; border-radius: 50%; flex-shrink: 0; margin-top: 2px;">${idx + 1}</div>
          <div style="flex: 1;">
            <div style="font-size: 9.5pt; font-weight: 700; color: #0f172a; margin-bottom: 2px;">${escapeHtml(val.title)}</div>
            <div style="font-size: 8.5pt; color: #475569; line-height: 1.45;">${escapeHtml(val.description)}</div>
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
    ${this.getBaseStyles()}
  </style>
</head>
<body>
  ${this.buildHeaderHtml(company)}

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
    <div>${valuesHtml}</div>
  </div>

  ${
    payload.motto
      ? `
  <div style="text-align: center; padding: 14px; background: #eff6ff; border: 1px dashed #3b82f6; border-radius: 6px; margin-top: 16px; page-break-inside: avoid;">
    <div style="font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1d4ed8; margin-bottom: 4px;">Lema Institucional</div>
    <div style="font-size: 11pt; font-weight: 800; font-style: italic; color: #1e3a8a;">"${escapeHtml(payload.motto)}"</div>
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
      <div class="signature-name">Recursos Humanos</div>
      <div class="signature-role">Departamento de Gestão de Pessoas</div>
    </div>
  </div>
</body>
</html>`;
  }

  public renderRegulationDocument(
    company: Company,
    payload: RegulationPayloadDto,
    versionNumber: number,
    publishedAt: Date = new Date(),
  ): string {
    const formattedPubDate = formatDateBR(publishedAt);
    const formattedEffDate = formatDateBR(payload.effectiveDate);

    const principlesHtml =
      payload.companyInfo.principles.length > 0
        ? `<ul class="bullet-list">${payload.companyInfo.principles.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
        : '';

    const prohibitionsHtml =
      payload.conductEthics.prohibitions.length > 0
        ? `<ul class="bullet-list">${payload.conductEthics.prohibitions.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
        : '';

    const additionalClausesHtml =
      payload.additionalClauses.length > 0
        ? payload.additionalClauses
            .map(
              (c, i) => `
        <div style="margin-top: 10px;">
          <h4 style="font-size: 9.5pt; font-weight: 700; color: #1e293b;">Cláusula ${i + 1}ª — ${escapeHtml(c.title)}</h4>
          <p style="font-size: 9pt; color: #334155; margin-top: 3px;">${escapeHtml(c.content)}</p>
        </div>`,
            )
            .join('')
        : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(payload.title)} - ${escapeHtml(company.tradeName)}</title>
  <style>
    ${this.getBaseStyles()}
  </style>
</head>
<body>
  ${this.buildHeaderHtml(company)}

  <div class="document-title-block">
    <h1 class="document-title">${escapeHtml(payload.title)}</h1>
    <div class="document-meta">Versão Oficial ${versionNumber} • Vigência a partir de ${formattedEffDate} • Publicado em ${formattedPubDate}</div>
  </div>

  <div class="section">
    <h3 class="section-title">Capítulo I — Disposições Gerais e Identificação da Empresa</h3>
    <div class="section-box">
      <p style="margin-bottom: 6px;"><strong>${escapeHtml(company.legalName)}</strong>, nome fantasia <strong>${escapeHtml(company.tradeName)}</strong>, inscrita no CNPJ sob o nº <strong>${escapeHtml(company.cnpj)}</strong>, estabelece por meio deste instrumento as normas, diretrizes e regras disciplinares aplicáveis a todos os seus colaboradores.</p>
      <p style="margin-bottom: 6px;">${escapeHtml(payload.companyInfo.presentation)}</p>
      ${principlesHtml ? `<p style="font-weight: 700; margin-top: 8px;">Princípios Orientadores:</p>${principlesHtml}` : ''}
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">Capítulo II — Da Jornada de Trabalho e Controle de Frequência</h3>
    <div class="section-box">
      <p style="margin-bottom: 6px;"><strong>Carga Horária:</strong> ${escapeHtml(payload.workSchedule.weeklyHours)} semanais, com intervalo intrajornada para refeição e descanso de <strong>${payload.workSchedule.lunchDurationMinutes} minutos</strong>.</p>
      <p style="margin-bottom: 6px;"><strong>Tolerância e Pontualidade:</strong> É admitida tolerância máxima de <strong>${payload.workSchedule.toleranceMinutes} minutos</strong> nas marcações de ponto, conforme limites legais.</p>
      <p style="margin-bottom: 6px;"><strong>Controle Eletrônico de Ponto:</strong> ${escapeHtml(payload.workSchedule.punchRules)}</p>
      <p><strong>Horas Suplementares:</strong> ${escapeHtml(payload.workSchedule.overtimePolicy)}</p>
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">Capítulo III — Das Normas de Conduta e Ética Profissional</h3>
    <div class="section-box">
      <p style="margin-bottom: 6px;"><strong>Vestimenta e Apresentação Pessoal:</strong> ${escapeHtml(payload.conductEthics.dressCode)}</p>
      <p style="margin-bottom: 6px;"><strong>Atendimento e Urbanidade:</strong> ${escapeHtml(payload.conductEthics.customerServiceEthics)}</p>
      <p style="margin-bottom: 6px;"><strong>Confidencialidade e Sigilo:</strong> ${escapeHtml(payload.conductEthics.confidentiality)}</p>
      <p style="font-weight: 700; margin-top: 8px; color: #991b1b;">Proibições Expressas:</p>
      ${prohibitionsHtml}
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">Capítulo IV — Do Uso de Tecnologia e Preservação do Patrimônio</h3>
    <div class="section-box">
      <p style="margin-bottom: 6px;"><strong>Aparelhos Celulares e Dispositivos Pessoais:</strong> ${escapeHtml(payload.technologyPolicy.personalDevicePolicy)}</p>
      <p style="margin-bottom: 6px;"><strong>Uso de Internet e Sistemas:</strong> ${escapeHtml(payload.technologyPolicy.internetUsage)}</p>
      <p style="margin-bottom: 6px;"><strong>Equipamentos e Ferramentas de Trabalho:</strong> ${escapeHtml(payload.technologyPolicy.companyEquipmentCare)}</p>
      <p><strong>Canais de Comunicação Institucional:</strong> ${escapeHtml(payload.technologyPolicy.communicationTools)}</p>
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">Capítulo V — Do Regime Disciplinar e Aplicação de Penalidades</h3>
    <div class="section-box">
      <p style="margin-bottom: 6px;">O descumprimento das normas estabelecidas neste Regimento Interno sujeita o colaborador às seguintes medidas disciplinares em ordem de gradação pedagógica:</p>
      <ul class="bullet-list" style="margin-bottom: 8px;">
        <li><strong>Advertência Verbal:</strong> ${escapeHtml(payload.disciplineRules.warningVerbalRules)}</li>
        <li><strong>Advertência Escrita:</strong> ${escapeHtml(payload.disciplineRules.warningWrittenRules)}</li>
        <li><strong>Suspensão Disciplinar:</strong> ${escapeHtml(payload.disciplineRules.suspensionRules)}</li>
        <li><strong>Demissão por Justa Causa:</strong> ${escapeHtml(payload.disciplineRules.terminationRules)}</li>
      </ul>
      ${payload.disciplineRules.progressionNotes ? `<p style="font-size: 8.5pt; color: #64748b; font-style: italic;">Nota: ${escapeHtml(payload.disciplineRules.progressionNotes)}</p>` : ''}
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">Capítulo VI — Disposições Finais e Vigência</h3>
    <div class="section-box">
      <p>O presente Regimento Interno entra em vigor na data de <strong>${formattedEffDate}</strong>, revogando disposições anteriores em contrário, passando a integrar contratualmente as relações individuais de trabalho de todos os empregados da empresa.</p>
      ${additionalClausesHtml}
    </div>
  </div>

  <div class="footer-signatures">
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">${escapeHtml(company.primaryContactName ?? 'Diretoria Executiva')}</div>
      <div class="signature-role">Diretoria • ${escapeHtml(company.tradeName)}</div>
    </div>
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">Assessoria Jurídica / RH</div>
      <div class="signature-role">Aprovação Regimental</div>
    </div>
  </div>
</body>
</html>`;
  }

  public renderRoleMapDocument(
    company: Company,
    payload: RoleMapPayloadDto,
    versionNumber: number,
    publishedAt: Date = new Date(),
  ): string {
    const formattedPubDate = formatDateBR(publishedAt);
    const formattedEffDate = formatDateBR(payload.effectiveDate);

    const responsibilitiesHtml = payload.responsibilities
      .map((r) => `<li>${escapeHtml(r)}</li>`)
      .join('');

    const requirementsHtml = payload.requirements.map((r) => `<li>${escapeHtml(r)}</li>`).join('');

    const competenciesHtml =
      payload.behavioralCompetencies && payload.behavioralCompetencies.length > 0
        ? payload.behavioralCompetencies.map((c) => `<li>${escapeHtml(c)}</li>`).join('')
        : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Descrição de Cargo - ${escapeHtml(payload.roleTitle)}</title>
  <style>
    ${this.getBaseStyles()}
  </style>
</head>
<body>
  ${this.buildHeaderHtml(company)}

  <div class="document-title-block">
    <h1 class="document-title">Descrição de Cargo e Atribuições</h1>
    <div class="document-meta">Versão ${versionNumber} • Vigência a partir de ${formattedEffDate} • Publicado em ${formattedPubDate}</div>
  </div>

  <table class="data-table" style="margin-bottom: 20px;">
    <tr>
      <th style="width: 25%;">Título do Cargo:</th>
      <td style="font-weight: 700; color: #1e3a8a;">${escapeHtml(payload.roleTitle)}</td>
      <th style="width: 20%;">CBO:</th>
      <td>${escapeHtml(payload.cbo ?? 'Não informado')}</td>
    </tr>
    <tr>
      <th>Departamento:</th>
      <td>${escapeHtml(payload.department ?? 'Operacional')}</td>
      <th>Empresa:</th>
      <td>${escapeHtml(company.tradeName)}</td>
    </tr>
  </table>

  <div class="section">
    <h3 class="section-title">1. Missão e Objetivo da Função</h3>
    <div class="section-box">${escapeHtml(payload.mission)}</div>
  </div>

  <div class="section">
    <h3 class="section-title">2. Principais Responsabilidades e Atribuições</h3>
    <div class="section-box">
      <ul class="bullet-list">
        ${responsibilitiesHtml}
      </ul>
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">3. Requisitos da Função e Qualificação</h3>
    <div class="section-box">
      <ul class="bullet-list">
        ${requirementsHtml}
      </ul>
    </div>
  </div>

  ${
    competenciesHtml
      ? `
  <div class="section">
    <h3 class="section-title">4. Competências Comportamentais Esperadas</h3>
    <div class="section-box">
      <ul class="bullet-list">
        ${competenciesHtml}
      </ul>
    </div>
  </div>`
      : ''
  }

  <div class="footer-signatures">
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">Gestor Imediato / Liderança</div>
      <div class="signature-role">Supervisão Direta</div>
    </div>
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">Recursos Humanos</div>
      <div class="signature-role">Homologação de Cargo</div>
    </div>
  </div>
</body>
</html>`;
  }

  public renderInterviewDocument(
    company: Company,
    payload: InterviewPayloadDto,
    publishedAt: Date = new Date(),
  ): string {
    const formattedPubDate = formatDateBR(publishedAt);
    const formattedIntDate = formatDateBR(payload.interviewDate);

    const recommendationLabels = {
      RECOMMENDED: 'RECOMENDADO PARA CONTRATAÇÃO',
      NOT_RECOMMENDED: 'NÃO RECOMENDADO',
      TALENT_POOL: 'BANCO DE TALENTOS / RESERVA',
    };

    const recommendationColors = {
      RECOMMENDED: { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
      NOT_RECOMMENDED: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
      TALENT_POOL: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    };

    const recStyle =
      recommendationColors[payload.recommendation] ?? recommendationColors.TALENT_POOL;

    const scoresRows = payload.criteriaScores
      .map(
        (c) => `
      <tr>
        <td style="font-weight: 600;">${escapeHtml(c.criterion)}</td>
        <td style="text-align: center; font-weight: 800; color: #1e3a8a;">${c.score} / 5</td>
        <td>${escapeHtml(c.notes ?? '-')}</td>
      </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Entrevista de Seleção - ${escapeHtml(payload.candidateName)}</title>
  <style>
    ${this.getBaseStyles()}
  </style>
</head>
<body>
  ${this.buildHeaderHtml(company)}

  <div class="document-title-block">
    <h1 class="document-title">Ficha e Roteiro de Entrevista de Contratação</h1>
    <div class="document-meta">Avaliação de Recrutamento • Registrado em ${formattedPubDate}</div>
  </div>

  <table class="data-table" style="margin-bottom: 20px;">
    <tr>
      <th style="width: 25%;">Nome do Candidato:</th>
      <td style="font-weight: 700; color: #1e3a8a;">${escapeHtml(payload.candidateName)}</td>
      <th style="width: 20%;">Data da Entrevista:</th>
      <td>${formattedIntDate}</td>
    </tr>
    <tr>
      <th>Cargo Pretendido:</th>
      <td>${escapeHtml(payload.roleTitle)}</td>
      <th>Entrevistador:</th>
      <td>${escapeHtml(payload.interviewerName)}</td>
    </tr>
    <tr>
      <th>E-mail do Candidato:</th>
      <td>${escapeHtml(payload.candidateEmail ?? 'Não informado')}</td>
      <th>Telefone:</th>
      <td>${escapeHtml(payload.candidatePhone ?? 'Não informado')}</td>
    </tr>
  </table>

  <div class="section">
    <h3 class="section-title">1. Avaliação por Critérios e Competências</h3>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 40%;">Critério / Competência</th>
          <th style="width: 15%; text-align: center;">Nota (1-5)</th>
          <th style="width: 45%;">Observações e Evidências</th>
        </tr>
      </thead>
      <tbody>
        ${scoresRows}
      </tbody>
    </table>
  </div>

  ${
    payload.generalNotes
      ? `
  <div class="section">
    <h3 class="section-title">2. Parecer e Impressões Gerais do Entrevistador</h3>
    <div class="section-box">${escapeHtml(payload.generalNotes)}</div>
  </div>`
      : ''
  }

  <div class="section">
    <h3 class="section-title">3. Recomendação Final do Processo Seletivo</h3>
    <div style="background: ${recStyle.bg}; border: 1.5px solid ${recStyle.border}; border-radius: 6px; padding: 12px; text-align: center;">
      <div style="font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 2px;">Decisão do Entrevistador</div>
      <div style="font-size: 12pt; font-weight: 900; color: ${recStyle.text};">${recommendationLabels[payload.recommendation]}</div>
    </div>
  </div>

  <div class="footer-signatures">
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">${escapeHtml(payload.interviewerName)}</div>
      <div class="signature-role">Entrevistador / Avaliador</div>
    </div>
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">Recursos Humanos</div>
      <div class="signature-role">PH Motopeças</div>
    </div>
  </div>
</body>
</html>`;
  }

  public renderAcknowledgmentRegulationDocument(
    company: Company,
    payload: AcknowledgmentRegulationPayloadDto,
    publishedAt: Date = new Date(),
  ): string {
    const formattedDate = formatDateBR(publishedAt);
    const city = company.addressCity ?? 'São Paulo';
    const state = company.addressState ?? 'SP';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Ciência do Regimento Interno</title>
  <style>
    ${this.getBaseStyles()}
  </style>
</head>
<body>
  ${this.buildHeaderHtml(company)}

  <div class="document-title-block">
    <h1 class="document-title">Termo de Recebimento e Ciência do Regimento Interno</h1>
    <div class="document-meta">Comprovante Formal de Ciência e Compromisso Funcional</div>
  </div>

  <div class="section" style="margin-top: 24px;">
    <div class="section-box" style="font-size: 10.5pt; line-height: 1.8; padding: 20px;">
      <p style="margin-bottom: 16px;">
        Eu, <strong>${escapeHtml(payload.employeeName)}</strong>, inscrito(a) no CPF sob o nº <strong>${escapeHtml(payload.employeeCpf ?? 'Registrado no Prontuário')}</strong>, colaborador(a) da empresa <strong>${escapeHtml(company.legalName)}</strong> (nome fantasia <strong>${escapeHtml(company.tradeName)}</strong>), inscrita no CNPJ sob o nº <strong>${escapeHtml(company.cnpj)}</strong>:
      </p>
      <p style="margin-bottom: 16px;">
        <strong>DECLARO</strong>, para todos os fins de direito, que recebi nesta data cópia integral do <strong>Regimento Interno de Trabalho (Versão ${payload.regulationVersionNumber})</strong>, com vigência estabelecida para a empresa.
      </p>
      <p style="margin-bottom: 16px;">
        Declaro ainda ter lido, compreendido e estar ciente de todas as suas disposições, diretrizes de conduta, ética, jornada de trabalho, controle de ponto, uso de tecnologias, política disciplinar e penalidades aplicáveis, comprometendo-me expressamente a respeitá-las e cumpri-las integralmente durante toda a vigência do meu contrato de trabalho.
      </p>
      <p style="text-align: right; margin-top: 30px; font-weight: 500;">
        ${escapeHtml(city)} - ${escapeHtml(state)}, ${formattedDate}.
      </p>
    </div>
  </div>

  <div class="footer-signatures" style="margin-top: 70px;">
    <div class="signature-block" style="width: 250px;">
      <div class="signature-line"></div>
      <div class="signature-name">${escapeHtml(payload.employeeName)}</div>
      <div class="signature-role">Colaborador(a)</div>
    </div>
    <div class="signature-block" style="width: 250px;">
      <div class="signature-line"></div>
      <div class="signature-name">${escapeHtml(company.legalName)}</div>
      <div class="signature-role">Empregador • Representante Legal</div>
    </div>
  </div>
</body>
</html>`;
  }

  public renderAcknowledgmentRoleDocument(
    company: Company,
    payload: AcknowledgmentRolePayloadDto,
    publishedAt: Date = new Date(),
  ): string {
    const formattedDate = formatDateBR(publishedAt);
    const city = company.addressCity ?? 'São Paulo';
    const state = company.addressState ?? 'SP';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Ciência da Descrição de Cargo</title>
  <style>
    ${this.getBaseStyles()}
  </style>
</head>
<body>
  ${this.buildHeaderHtml(company)}

  <div class="document-title-block">
    <h1 class="document-title">Termo de Recebimento e Ciência da Descrição de Cargo</h1>
    <div class="document-meta">Formalização das Responsabilidades, Atribuições e Metas</div>
  </div>

  <div class="section" style="margin-top: 24px;">
    <div class="section-box" style="font-size: 10.5pt; line-height: 1.8; padding: 20px;">
      <p style="margin-bottom: 16px;">
        Eu, <strong>${escapeHtml(payload.employeeName)}</strong>, inscrito(a) no CPF sob o nº <strong>${escapeHtml(payload.employeeCpf ?? 'Registrado no Prontuário')}</strong>, admitido(a) / alocado(a) na função de <strong>${escapeHtml(payload.roleTitle)}</strong>${payload.department ? ` (Departamento de ${escapeHtml(payload.department)})` : ''}, na empresa <strong>${escapeHtml(company.legalName)}</strong> (CNPJ <strong>${escapeHtml(company.cnpj)}</strong>):
      </p>
      <p style="margin-bottom: 16px;">
        <strong>DECLARO</strong> ter recebido, lido e tomado pleno conhecimento das responsabilidades, atribuições operacionais, requisitos e normas de conduta específicas inerentes ao cargo que ocupo, constantes da <strong>Descrição de Cargo (Versão ${payload.roleVersionNumber})</strong>.
      </p>
      <p style="margin-bottom: 16px;">
        Comprometo-me a executar minhas atividades diárias com zelo, dedicação, pontualidade e em estrita consonância com os procedimentos operacionais e orientações da diretoria da PH Motopeças.
      </p>
      <p style="text-align: right; margin-top: 30px; font-weight: 500;">
        ${escapeHtml(city)} - ${escapeHtml(state)}, ${formattedDate}.
      </p>
    </div>
  </div>

  <div class="footer-signatures" style="margin-top: 70px;">
    <div class="signature-block" style="width: 250px;">
      <div class="signature-line"></div>
      <div class="signature-name">${escapeHtml(payload.employeeName)}</div>
      <div class="signature-role">Colaborador(a)</div>
    </div>
    <div class="signature-block" style="width: 250px;">
      <div class="signature-line"></div>
      <div class="signature-name">Gestor Imediato / RH</div>
      <div class="signature-role">${escapeHtml(company.tradeName)}</div>
    </div>
  </div>
</body>
</html>`;
  }

  public renderDisciplineVerbalDocument(
    company: Company,
    payload: DisciplineVerbalPayloadDto,
    publishedAt: Date = new Date(),
  ): string {
    const formattedPubDate = formatDateBR(publishedAt);
    const formattedIncidentDate = formatDateBR(payload.incidentDate);
    const city = company.addressCity ?? 'São Paulo';
    const state = company.addressState ?? 'SP';

    const witnessesHtml =
      payload.witnesses && payload.witnesses.length > 0
        ? `
  <div class="section" style="margin-top: 20px;">
    <h3 class="section-title">Testemunhas Presentes</h3>
    <table class="meta-table">
      ${payload.witnesses
        .map(
          (w, idx) => `
        <tr>
          <th>Testemunha ${idx + 1}:</th>
          <td>${escapeHtml(w.name)}</td>
          <th>CPF:</th>
          <td>${escapeHtml(w.cpf ?? 'Não informado')}</td>
        </tr>`,
        )
        .join('')}
    </table>
  </div>`
        : '';

    const witnessSignaturesHtml =
      payload.witnesses && payload.witnesses.length > 0
        ? `
  <div class="footer-signatures" style="margin-top: 30px;">
    ${payload.witnesses
      .map(
        (w) => `
      <div class="signature-block" style="width: 220px;">
        <div class="signature-line"></div>
        <div class="signature-name">${escapeHtml(w.name)}</div>
        <div class="signature-role">Testemunha</div>
      </div>`,
      )
      .join('')}
  </div>`
        : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Registro de Conversa Disciplinar - ${escapeHtml(payload.employeeName)}</title>
  <style>
    ${this.getBaseStyles()}
  </style>
</head>
<body>
  ${this.buildHeaderHtml(company)}

  <div class="document-title-block">
    <h1 class="document-title">Registro Formal de Conversa Disciplinar e Orientação Funcional</h1>
    <div class="document-meta">Procedimento Disciplinar Orientativo • Advertência Verbal Formalizada</div>
  </div>

  <table class="meta-table">
    <tr>
      <th>Colaborador(a):</th>
      <td><strong>${escapeHtml(payload.employeeName)}</strong></td>
      <th>CPF:</th>
      <td>${escapeHtml(payload.employeeCpf ?? 'Registrado no Prontuário')}</td>
    </tr>
    <tr>
      <th>Função / Cargo:</th>
      <td>${escapeHtml(payload.employeeRole ?? 'Colaborador Operacional')}</td>
      <th>Data do Ocorrido:</th>
      <td>${formattedIncidentDate}</td>
    </tr>
    <tr>
      <th>Local da Ocorrência:</th>
      <td colspan="3">${escapeHtml(payload.location ?? 'Sede da PH Motopeças')}</td>
    </tr>
  </table>

  <div class="section">
    <h3 class="section-title">1. Motivo e Relato dos Fatos Observados</h3>
    <div class="section-box">
      <p style="font-weight: 600; margin-bottom: 8px; color: #1e3a8a;">Motivo: ${escapeHtml(payload.reason)}</p>
      <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(payload.details)}</p>
    </div>
  </div>

  ${
    payload.internalClauseRef
      ? `
  <div class="section">
    <h3 class="section-title">2. Dispositivo Regulamentar Pertinente</h3>
    <div class="section-box">
      <p>Constatou-se inobservância às diretrizes fixadas no Regimento Interno da empresa: <strong>${escapeHtml(payload.internalClauseRef)}</strong>.</p>
    </div>
  </div>`
      : ''
  }

  <div class="section">
    <h3 class="section-title">3. Orientações e Medidas Pedagógicas</h3>
    <div class="section-box">
      <p style="margin-bottom: 8px;">
        Nesta data, o(a) colaborador(a) acima qualificado(a) foi orientado(a) verbalmente quanto à conduta profissional e técnica esperada, reforçando a importância do cumprimento rigoroso dos procedimentos operacionais, horários e normas da empresa.
      </p>
      ${
        payload.commitment
          ? `<p style="margin-top: 8px; font-weight: 500;"><strong>Compromisso do Colaborador:</strong> ${escapeHtml(payload.commitment)}</p>`
          : ''
      }
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">4. Notificação de Reincidência e Progressão Disciplinar</h3>
    <div class="section-box" style="background-color: #f8fafc; border-left: 4px solid #3b82f6;">
      <p style="font-size: 9pt; color: #334155;">
        O(A) colaborador(a) fica expressamente ciente de que esta medida possui caráter pedagógico e orientativo. A reiteração na mesma conduta ou cometimento de nova infração sujeitará o(a) empregado(a) a penalidades mais severas, tais como Advertência Escrita, Suspensão Disciplinar e eventual Rescisão Contratual por Justa Causa, nos termos da CLT.
      </p>
    </div>
  </div>

  ${witnessesHtml}

  <p style="text-align: right; margin-top: 24px; font-weight: 500; font-size: 9pt;">
    ${escapeHtml(city)} - ${escapeHtml(state)}, ${formattedPubDate}.
  </p>

  <div class="footer-signatures" style="margin-top: 50px;">
    <div class="signature-block" style="width: 250px;">
      <div class="signature-line"></div>
      <div class="signature-name">${escapeHtml(payload.employeeName)}</div>
      <div class="signature-role">Colaborador(a) Orientado(a)</div>
    </div>
    <div class="signature-block" style="width: 250px;">
      <div class="signature-line"></div>
      <div class="signature-name">Gestor Imediato / Liderança</div>
      <div class="signature-role">${escapeHtml(company.tradeName)}</div>
    </div>
  </div>

  ${witnessSignaturesHtml}
</body>
</html>`;
  }

  public renderDisciplineWrittenDocument(
    company: Company,
    payload: DisciplineWrittenPayloadDto,
    publishedAt: Date = new Date(),
  ): string {
    const formattedPubDate = formatDateBR(publishedAt);
    const formattedIncidentDate = formatDateBR(payload.incidentDate);
    const city = company.addressCity ?? 'São Paulo';
    const state = company.addressState ?? 'SP';

    const witnessesHtml =
      payload.witnesses && payload.witnesses.length > 0
        ? `
  <div class="section" style="margin-top: 20px;">
    <h3 class="section-title">Testemunhas</h3>
    <table class="meta-table">
      ${payload.witnesses
        .map(
          (w, idx) => `
        <tr>
          <th>Testemunha ${idx + 1}:</th>
          <td>${escapeHtml(w.name)}</td>
          <th>CPF:</th>
          <td>${escapeHtml(w.cpf ?? 'Não informado')}</td>
        </tr>`,
        )
        .join('')}
    </table>
  </div>`
        : '';

    const witnessSignaturesHtml =
      payload.witnesses && payload.witnesses.length > 0
        ? `
  <div class="footer-signatures" style="margin-top: 30px;">
    ${payload.witnesses
      .map(
        (w) => `
      <div class="signature-block" style="width: 220px;">
        <div class="signature-line"></div>
        <div class="signature-name">${escapeHtml(w.name)}</div>
        <div class="signature-role">Testemunha</div>
      </div>`,
      )
      .join('')}
  </div>`
        : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Advertência Disciplinar Escrita - ${escapeHtml(payload.employeeName)}</title>
  <style>
    ${this.getBaseStyles()}
  </style>
</head>
<body>
  ${this.buildHeaderHtml(company)}

  <div class="document-title-block">
    <h1 class="document-title">Termo de Advertência Disciplinar Escrita</h1>
    <div class="document-meta">Aplicação de Penalidade Disciplinar nos Termos da Legislação Trabalhista (CLT)</div>
  </div>

  <table class="meta-table">
    <tr>
      <th>Colaborador(a):</th>
      <td><strong>${escapeHtml(payload.employeeName)}</strong></td>
      <th>CPF:</th>
      <td>${escapeHtml(payload.employeeCpf ?? 'Registrado no Prontuário')}</td>
    </tr>
    <tr>
      <th>Função / Cargo:</th>
      <td>${escapeHtml(payload.employeeRole ?? 'Colaborador')}</td>
      <th>Data do Ocorrido:</th>
      <td>${formattedIncidentDate}</td>
    </tr>
    <tr>
      <th>Local da Ocorrência:</th>
      <td colspan="3">${escapeHtml(payload.location ?? 'Instalações da Empresa')}</td>
    </tr>
  </table>

  <div class="section">
    <h3 class="section-title">1. Motivo e Descrição dos Fatos</h3>
    <div class="section-box">
      <p style="font-weight: 600; margin-bottom: 8px; color: #b91c1c;">Infração: ${escapeHtml(payload.reason)}</p>
      <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(payload.details)}</p>
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">2. Enquadramento Legal e Normativo</h3>
    <div class="section-box">
      ${
        payload.legalBasisRef
          ? `<p style="margin-bottom: 6px;"><strong>Dispositivo Legal:</strong> ${escapeHtml(payload.legalBasisRef)}.</p>`
          : '<p style="margin-bottom: 6px;"><strong>Dispositivo Legal:</strong> Artigo 482 e prerrogativas do poder disciplinar empregatício (Artigo 2º da CLT).</p>'
      }
      ${
        payload.internalClauseRef
          ? `<p><strong>Norma Interna:</strong> ${escapeHtml(payload.internalClauseRef)}.</p>`
          : ''
      }
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">3. Advertência Formal e Notificação de Reincidência</h3>
    <div class="section-box" style="background-color: #fff1f2; border-left: 4px solid #e11d48;">
      <p style="margin-bottom: 8px;">
        Servimo-nos do presente para aplicar-lhe <strong>ADVERTÊNCIA DISCIPLINAR ESCRITA</strong> pela falta cometida, solicitando que doravante adote comportamento e conduta condizentes com os padrões exigidos.
      </p>
      <p style="font-size: 9pt; color: #881337;">
        ${
          payload.consequencesNote
            ? escapeHtml(payload.consequencesNote)
            : 'Fica expressamente advertido(a) de que a reincidência na mesma conduta ou a prática de qualquer outra falta funcional sujeitará V. Sa. a sanções mais severas, inclusive Suspensão Disciplinar ou Rescisão do Contrato de Trabalho por Justa Causa, consoante os termos do art. 482 da CLT.'
        }
      </p>
    </div>
  </div>

  ${witnessesHtml}

  <p style="text-align: right; margin-top: 24px; font-weight: 500; font-size: 9pt;">
    ${escapeHtml(city)} - ${escapeHtml(state)}, ${formattedPubDate}.
  </p>

  <div class="footer-signatures" style="margin-top: 50px;">
    <div class="signature-block" style="width: 250px;">
      <div class="signature-line"></div>
      <div class="signature-name">${escapeHtml(payload.employeeName)}</div>
      <div class="signature-role">Ciente do Colaborador</div>
    </div>
    <div class="signature-block" style="width: 250px;">
      <div class="signature-line"></div>
      <div class="signature-name">Diretoria / RH</div>
      <div class="signature-role">${escapeHtml(company.tradeName)}</div>
    </div>
  </div>

  ${witnessSignaturesHtml}
</body>
</html>`;
  }

  public renderDisciplineSuspensionDocument(
    company: Company,
    payload: DisciplineSuspensionPayloadDto,
    publishedAt: Date = new Date(),
  ): string {
    const formattedPubDate = formatDateBR(publishedAt);
    const formattedIncidentDate = formatDateBR(payload.incidentDate);
    const formattedStartDate = formatDateBR(payload.suspensionStartDate);
    const formattedEndDate = formatDateBR(payload.suspensionEndDate);
    const formattedReturnDate = formatDateBR(payload.returnDate);
    const city = company.addressCity ?? 'São Paulo';
    const state = company.addressState ?? 'SP';

    const witnessesHtml =
      payload.witnesses && payload.witnesses.length > 0
        ? `
  <div class="section" style="margin-top: 20px;">
    <h3 class="section-title">Testemunhas</h3>
    <table class="meta-table">
      ${payload.witnesses
        .map(
          (w, idx) => `
        <tr>
          <th>Testemunha ${idx + 1}:</th>
          <td>${escapeHtml(w.name)}</td>
          <th>CPF:</th>
          <td>${escapeHtml(w.cpf ?? 'Não informado')}</td>
        </tr>`,
        )
        .join('')}
    </table>
  </div>`
        : '';

    const witnessSignaturesHtml =
      payload.witnesses && payload.witnesses.length > 0
        ? `
  <div class="footer-signatures" style="margin-top: 30px;">
    ${payload.witnesses
      .map(
        (w) => `
      <div class="signature-block" style="width: 220px;">
        <div class="signature-line"></div>
        <div class="signature-name">${escapeHtml(w.name)}</div>
        <div class="signature-role">Testemunha</div>
      </div>`,
      )
      .join('')}
  </div>`
        : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Suspensão Disciplinar - ${escapeHtml(payload.employeeName)}</title>
  <style>
    ${this.getBaseStyles()}
  </style>
</head>
<body>
  ${this.buildHeaderHtml(company)}

  <div class="document-title-block">
    <h1 class="document-title">Termo de Suspensão Disciplinar</h1>
    <div class="document-meta">Aplicação de Penalidade de Suspensão com Base no Artigo 474 da CLT</div>
  </div>

  <table class="meta-table">
    <tr>
      <th>Colaborador(a):</th>
      <td><strong>${escapeHtml(payload.employeeName)}</strong></td>
      <th>CPF:</th>
      <td>${escapeHtml(payload.employeeCpf ?? 'Registrado no Prontuário')}</td>
    </tr>
    <tr>
      <th>Função / Cargo:</th>
      <td>${escapeHtml(payload.employeeRole ?? 'Colaborador')}</td>
      <th>Data do Ocorrido:</th>
      <td>${formattedIncidentDate}</td>
    </tr>
    <tr>
      <th>Prazo da Suspensão:</th>
      <td><strong>${payload.suspensionDays} ${payload.suspensionDays === 1 ? 'dia' : 'dias'}</strong></td>
      <th>Período de Afastamento:</th>
      <td>De ${formattedStartDate} até ${formattedEndDate}</td>
    </tr>
    <tr>
      <th>Retorno ao Trabalho:</th>
      <td colspan="3"><strong style="color: #1e3a8a;">${formattedReturnDate}</strong> (no horário normal de início de expediente)</td>
    </tr>
  </table>

  <div class="section">
    <h3 class="section-title">1. Motivo e Fundamentação dos Fatos</h3>
    <div class="section-box">
      <p style="font-weight: 600; margin-bottom: 8px; color: #b91c1c;">Falta Cometida: ${escapeHtml(payload.reason)}</p>
      <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(payload.details)}</p>
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">2. Penalidade Disciplinar Aplicada</h3>
    <div class="section-box">
      <p style="margin-bottom: 8px;">
        Em virtude da gravidade do fato acima narrado e da inobservância das normas da empresa, comunicamos que V. Sa. fica <strong>SUSPENSO(A) DISCIPLINARMENTE DE SUAS FUNÇÕES</strong> pelo período de <strong>${payload.suspensionDays} (${payload.suspensionDays === 1 ? 'dia' : 'dias'})</strong>, com início em <strong>${formattedStartDate}</strong> e término em <strong>${formattedEndDate}</strong>.
      </p>
      <p style="margin-bottom: 8px;">
        Deverá retornar impreterivelmente às suas atividades profissionais no dia <strong>${formattedReturnDate}</strong>, em seu horário contratual habitual.
      </p>
      ${
        payload.legalBasisRef
          ? `<p style="margin-top: 6px;"><strong>Dispositivo Legal:</strong> ${escapeHtml(payload.legalBasisRef)} e Art. 474 da CLT.</p>`
          : '<p style="margin-top: 6px;"><strong>Dispositivo Legal:</strong> Artigo 474 e Artigo 482 da CLT.</p>'
      }
      ${
        payload.internalClauseRef
          ? `<p><strong>Regimento Interno:</strong> ${escapeHtml(payload.internalClauseRef)}.</p>`
          : ''
      }
    </div>
  </div>

  <div class="section">
    <h3 class="section-title">3. Notificação Final sobre Reincidência e Rescisão por Justa Causa</h3>
    <div class="section-box" style="background-color: #fef2f2; border-left: 4px solid #dc2626;">
      <p style="font-size: 9.5pt; color: #991b1b; line-height: 1.6;">
        ${
          payload.consequencesNote
            ? escapeHtml(payload.consequencesNote)
            : 'Fica expressamente cientificado(a) de que a reincidência na mesma conduta, ou a prática de qualquer outra falta violadora das obrigações contratuais e do Regimento Interno, acarretará a imediata RESCISÃO DO CONTRATO DE TRABALHO POR JUSTA CAUSA, com fundamento no artigo 482 da Consolidação das Leis do Trabalho (CLT).'
        }
      </p>
    </div>
  </div>

  ${witnessesHtml}

  <p style="text-align: right; margin-top: 24px; font-weight: 500; font-size: 9pt;">
    ${escapeHtml(city)} - ${escapeHtml(state)}, ${formattedPubDate}.
  </p>

  <div class="footer-signatures" style="margin-top: 50px;">
    <div class="signature-block" style="width: 250px;">
      <div class="signature-line"></div>
      <div class="signature-name">${escapeHtml(payload.employeeName)}</div>
      <div class="signature-role">Ciente do Colaborador</div>
    </div>
    <div class="signature-block" style="width: 250px;">
      <div class="signature-line"></div>
      <div class="signature-name">Diretoria Executiva / RH</div>
      <div class="signature-role">${escapeHtml(company.tradeName)}</div>
    </div>
  </div>

  ${witnessSignaturesHtml}
</body>
</html>`;
  }
}
