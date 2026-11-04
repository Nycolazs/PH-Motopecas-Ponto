/**
 * Presentation demo only: the HR demo seed records generated documents that all point at a
 * placeholder artifact with no file behind it, so "Ver"/download returns 404. This script
 * renders a real, encrypted PDF for each of those documents with the production templates
 * and renderer, then repoints the document at its own artifact.
 *
 * Runs inside the API image (it needs Chromium):
 *   node dist/database/render-demo-documents.js
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { validateEnvironment } from '../config/environment.js';
import { DocumentStorageService } from '../documents/document-storage.service.js';
import {
  DocumentTemplatesService,
  renumberSectionTitles,
} from '../documents/document-templates.service.js';
import { PdfRendererService } from '../documents/pdf-renderer.service.js';
import { DocumentType, PrismaClient } from '../generated/prisma/client.js';

const PLACEHOLDER_STORAGE_PATH = 'artifacts/demo/ph-ponto-demo.pdf';

const INTERVIEW_CRITERIA: Record<string, string> = {
  experiencia_tecnica: 'Experiência e Conhecimento Técnico',
  postura_etica: 'Postura Profissional e Ética',
  comunicacao_equipe: 'Comunicação e Trabalho em Equipe',
  seguranca_trabalho: 'Consciência de Segurança do Trabalho',
};

function isoDate(date: Date | null | undefined): string {
  return (date ?? new Date()).toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const environment = validateEnvironment(process.env);
  const config = { get: (key: string) => (environment as unknown as Record<string, unknown>)[key] };
  const templates = new DocumentTemplatesService();
  const renderer = new PdfRendererService(config as never);
  const storage = new DocumentStorageService(config as never);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: environment.DATABASE_URL,
      options: '-c timezone=UTC',
    }),
  });

  try {
    const company = await prisma.company.findFirstOrThrow();
    const documents = await prisma.generatedDocument.findMany({
      where: { artifact: { storagePath: PLACEHOLDER_STORAGE_PATH } },
      orderBy: { createdAt: 'asc' },
    });
    if (documents.length === 0) {
      console.info('PH-Ponto demo documents: nothing to render.');
      return;
    }

    const employeeInfo = async (employeeId: string) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: employeeId },
        include: {
          employeeProfile: true,
          roleAssignments: {
            where: { isPrincipal: true },
            include: { jobRoleVersion: true },
            take: 1,
          },
        },
      });
      return {
        employeeId: user.id,
        employeeName: user.name,
        employeeCpf: user.employeeProfile?.cpf ?? null,
        employeeRole: user.roleAssignments[0]?.jobRoleVersion.title ?? null,
      };
    };

    const regulationPayload = {
      title: 'Regimento Interno Padrão — PH Motopeças',
      effectiveDate: '2026-01-01',
      companyInfo: {
        tradeName: company.tradeName ?? 'PH Motopeças',
        legalName: company.legalName,
        cnpj: company.cnpj ?? '12.345.678/0001-90',
        presentation:
          'A PH Motopeças é dedicada ao fornecimento de peças e serviços de excelência para motocicletas, com atendimento técnico especializado em Fortaleza.',
        principles: [
          'Disciplina operacional e respeito recíproco entre colegas, liderança e clientes.',
          'Uso seguro de ferramentas, equipamentos e veículos de clientes.',
        ],
      },
      workSchedule: {
        weeklyHours: '44 horas semanais (segunda a sexta 08h–17h, sábado 08h–12h)',
        lunchDurationMinutes: 60,
        toleranceMinutes: 5,
        overtimePolicy:
          'Horas extras somente com autorização prévia da gerência, compensadas em banco de horas ou pagas conforme a CLT.',
        punchRules:
          'Todas as entradas e saídas, inclusive o intervalo de almoço, devem ser registradas pessoalmente no PH-Ponto. Esquecimentos devem ser comunicados no mesmo dia por solicitação de ajuste.',
      },
      conductEthics: {
        dressCode:
          'Uso obrigatório de uniforme limpo e botas com biqueira de proteção na oficina mecânica.',
        customerServiceEthics:
          'Atendimento cordial, diagnósticos honestos e transparência total sobre peças e serviços.',
        confidentiality:
          'Dados de clientes, preços de fornecedores e informações internas são confidenciais.',
        prohibitions: [
          'Uso de álcool ou substâncias ilícitas no ambiente de trabalho.',
          'Retirada de peças, ferramentas ou veículos sem autorização.',
          'Pilotar motocicletas de clientes fora dos testes autorizados.',
        ],
      },
      technologyPolicy: {
        internetUsage: 'A internet corporativa é destinada às atividades da empresa.',
        personalDevicePolicy:
          'Celulares pessoais devem permanecer guardados durante a execução de serviços na bancada.',
        companyEquipmentCare:
          'Scanners de injeção e ferramentas de precisão devem ser devolvidos limpos ao final do expediente.',
        communicationTools: 'Comunicados oficiais são feitos pelo PH-Ponto e pelo grupo da equipe.',
      },
      disciplineRules: {
        warningVerbalRules: 'Faltas leves e primeiras ocorrências: orientação verbal registrada.',
        warningWrittenRules: 'Reincidência ou faltas moderadas: advertência escrita assinada.',
        suspensionRules:
          'Faltas graves ou reincidência após advertência escrita: suspensão de 1 a 30 dias.',
        terminationRules: 'Hipóteses do art. 482 da CLT: demissão por justa causa.',
        progressionNotes: 'A gradação respeita proporcionalidade, imediatidade e histórico.',
      },
      additionalClauses: [],
    };

    let rendered = 0;
    for (const document of documents) {
      const published = document.createdAt;
      let html: string;

      switch (document.documentType) {
        case DocumentType.CULTURE: {
          const version = await prisma.cultureProfileVersion.findFirstOrThrow({
            orderBy: { versionNumber: 'desc' },
          });
          html = templates.renderCultureDocument(
            company,
            {
              mission: version.mission,
              vision: version.vision,
              values: version.values as { title: string; description: string }[],
              motto: version.motto,
            },
            version.versionNumber,
            published,
          );
          break;
        }
        case DocumentType.REGULATION:
          html = templates.renderRegulationDocument(company, regulationPayload, 1, published);
          break;
        case DocumentType.ROLE_MAP: {
          const data = document.documentData as { roleTitle?: string };
          const version = await prisma.jobRoleVersion.findFirstOrThrow({
            where: { title: data.roleTitle ?? '' },
            include: { jobRole: true },
            orderBy: { versionNumber: 'desc' },
          });
          html = templates.renderRoleMapDocument(
            company,
            {
              jobRoleId: version.jobRoleId,
              roleTitle: version.title,
              department: version.jobRole.department,
              cbo: version.cbo,
              mission: version.description,
              responsibilities: version.responsibilities as string[],
              requirements: version.requirements as string[],
              behavioralCompetencies: ['Comprometimento', 'Trabalho em equipe', 'Organização'],
              effectiveDate: isoDate(version.createdAt),
            },
            version.versionNumber,
            published,
          );
          break;
        }
        case DocumentType.ACKNOWLEDGMENT_REGULATION: {
          const employee = await employeeInfo(document.employeeId!);
          const version = await prisma.companyRegulationVersion.findFirstOrThrow({
            orderBy: { versionNumber: 'desc' },
          });
          html = templates.renderAcknowledgmentRegulationDocument(
            company,
            {
              ...employee,
              regulationVersionId: version.id,
              regulationVersionNumber: version.versionNumber,
              regulationTitle: version.title,
              effectiveDate: isoDate(version.effectiveDate),
            },
            published,
          );
          break;
        }
        case DocumentType.ACKNOWLEDGMENT_ROLE: {
          const employee = await employeeInfo(document.employeeId!);
          const ack = await prisma.employeeDocumentAcknowledgment.findFirst({
            where: { generatedDocumentId: document.id },
            include: { jobRoleVersion: { include: { jobRole: true } } },
          });
          const version = ack?.jobRoleVersion;
          html = templates.renderAcknowledgmentRoleDocument(
            company,
            {
              ...employee,
              jobRoleVersionId: version?.id ?? document.id,
              roleTitle: version?.title ?? employee.employeeRole ?? 'Colaborador',
              roleVersionNumber: version?.versionNumber ?? 1,
              department: version?.jobRole.department ?? null,
              effectiveDate: isoDate(version?.createdAt),
            },
            published,
          );
          break;
        }
        case DocumentType.INTERVIEW: {
          const interview = await prisma.hiringInterview.findFirstOrThrow({
            where: { generatedDocumentId: document.id },
          });
          const scores = interview.scores as Record<string, number>;
          html = templates.renderInterviewDocument(
            company,
            {
              candidateName: interview.candidateName,
              candidateEmail: interview.candidateEmail,
              candidatePhone: interview.candidatePhone,
              jobRoleId: interview.jobRoleId,
              roleTitle: interview.roleTitle,
              interviewDate: isoDate(interview.interviewDate),
              interviewerName: interview.interviewerName,
              criteriaScores: Object.entries(scores).map(([key, score]) => ({
                criterion: INTERVIEW_CRITERIA[key] ?? key,
                score,
              })),
              generalNotes: interview.notes ?? undefined,
              recommendation: interview.recommendation,
            },
            published,
          );
          break;
        }
        case DocumentType.PERFORMANCE_REVIEW: {
          const review = await prisma.performanceReview.findFirstOrThrow({
            where: { generatedDocumentId: document.id },
            include: { evaluator: true },
          });
          const employee = await employeeInfo(review.employeeId);
          html = templates.renderPerformanceReviewDocument(company, {
            ...employee,
            evaluationPeriod: review.evaluationPeriod,
            evaluationDate: isoDate(review.evaluationDate),
            evaluatorId: review.evaluatorId,
            evaluatorName: review.evaluator.name,
            evaluatorRole: 'Gerência',
            criteriaScores: review.scores as never,
            strengths: 'Domínio técnico de motores e injeção eletrônica; referência para a equipe.',
            improvements: 'Registrar com mais detalhe as ordens de serviço concluídas.',
            actionPlan: 'Treinamento em diagnóstico de motos de alta cilindrada no 2º semestre.',
            evaluatorComments:
              'Colaborador de alto desempenho, apto a assumir mais responsabilidades.',
            employeeComments: null,
          });
          break;
        }
        case DocumentType.DISCIPLINE_VERBAL: {
          const action = await prisma.disciplinaryAction.findFirstOrThrow({
            where: { generatedDocumentId: document.id },
          });
          const employee = await employeeInfo(action.employeeId);
          html = templates.renderDisciplineVerbalDocument(
            company,
            {
              ...employee,
              incidentDate: isoDate(action.incidentDate),
              location: 'Oficina — PH Motopeças',
              reason: action.reason,
              details: action.details,
              internalClauseRef: action.internalClauseRef,
              priorActionId: null,
              commitment:
                'O colaborador compromete-se a comunicar com antecedência qualquer imprevisto que afete o horário de entrada.',
              witnesses: [],
            },
            published,
          );
          break;
        }
        default:
          console.warn(`Skipping unsupported demo document type ${document.documentType}.`);
          continue;
      }

      const pdf = await renderer.renderHtmlToPdf(renumberSectionTitles(html));
      const preview = await storage.savePreview(pdf);
      const storagePath = await storage.moveToArchive(preview.id, preview.storagePath, published);
      await prisma.documentArtifact.create({
        data: {
          id: preview.id,
          storagePath,
          fileSize: preview.fileSize,
          mimeType: preview.mimeType,
          checksumSha256: preview.checksumSha256,
        },
      });
      await prisma.generatedDocument.update({
        where: { id: document.id },
        data: { artifactId: preview.id },
      });
      rendered += 1;
      console.info(`Rendered ${document.documentType}: ${document.title}`);
    }

    console.info(`PH-Ponto demo documents: ${rendered} of ${documents.length} PDFs rendered.`);
  } finally {
    await renderer.onApplicationShutdown();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('PH-Ponto demo document rendering failed.', error);
  process.exitCode = 1;
});
