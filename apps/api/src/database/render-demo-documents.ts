/**
 * Presentation demo only: the HR demo seed records generated documents that all point at a
 * placeholder artifact with no file behind it, so "Ver"/download returns 404. This script
 * renders a real, encrypted PDF for each of those documents with the production templates
 * and renderer, then repoints the document at its own artifact.
 *
 * Runs inside the API image (it needs Chromium):
 *   node dist/database/render-demo-documents.js
 */
import { BRAND } from '@ph-ponto/shared';
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

/**
 * The seed points demo documents at a placeholder artifact with no file behind it. Once every
 * document has its real PDF, drop the placeholder: otherwise the hourly archive maintenance
 * keeps trying (and failing) to encrypt a file that does not exist.
 */
async function removeUnusedPlaceholder(prisma: PrismaClient): Promise<void> {
  const { count } = await prisma.documentArtifact.deleteMany({
    where: {
      storagePath: PLACEHOLDER_STORAGE_PATH,
      generatedDocuments: { none: {} },
      drafts: { none: {} },
      renderJobs: { none: {} },
    },
  });
  if (count > 0) console.info('Demo documents: unused placeholder artifact removed.');
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
      console.info('Demo documents: nothing to render.');
      await removeUnusedPlaceholder(prisma);
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
      title: `Regimento Interno Padrão — ${company.tradeName ?? BRAND.companyName}`,
      effectiveDate: '2026-01-01',
      companyInfo: {
        tradeName: company.tradeName ?? BRAND.companyName,
        legalName: company.legalName,
        cnpj: company.cnpj ?? '00.000.000/0001-00',
        presentation: `A ${company.tradeName ?? BRAND.companyName} é dedicada à prestação de serviços corporativos, consultoria operacional e atendimento especializado com foco em eficiência e qualidade.`,
        principles: [
          'Disciplina operacional e respeito recíproco entre colegas, liderança e clientes.',
          'Uso seguro e responsável de equipamentos, sistemas e recursos da empresa.',
        ],
      },
      workSchedule: {
        weeklyHours: '44 horas semanais (segunda a sexta 08h–17h, sábado 08h–12h)',
        lunchDurationMinutes: 60,
        toleranceMinutes: 5,
        overtimePolicy:
          'Horas extras somente com autorização prévia da gerência, compensadas em banco de horas ou pagas conforme a CLT.',
        punchRules:
          'Todas as entradas e saídas, inclusive o intervalo de almoço, devem ser registradas pessoalmente no ${BRAND.productName}. Esquecimentos devem ser comunicados no mesmo dia por solicitação de ajuste.',
      },
      conductEthics: {
        dressCode: 'Traje adequado ao atendimento ao público e crachá de identificação visível.',
        customerServiceEthics:
          'Atendimento cordial, orientações honestas e transparência total sobre produtos e serviços.',
        confidentiality:
          'Dados de clientes, preços de fornecedores e informações internas são confidenciais.',
        prohibitions: [
          'Uso de álcool ou substâncias ilícitas no ambiente de trabalho.',
          'Retirada de equipamentos ou documentos da empresa sem autorização.',
          'Compartilhar senhas de sistemas ou dados de clientes.',
        ],
      },
      technologyPolicy: {
        internetUsage: 'A internet corporativa é destinada às atividades da empresa.',
        personalDevicePolicy:
          'Celulares pessoais devem ser usados com moderação durante o atendimento.',
        companyEquipmentCare:
          'Notebooks e equipamentos da empresa devem ser guardados com segurança ao final do expediente.',
        communicationTools: `Comunicados oficiais são feitos pelo ${BRAND.productName} e pelo grupo da equipe.`,
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
            strengths:
              'Excelente domínio dos processos operacionais e sistemas internos; referência técnica para a equipe.',
            improvements: 'Registrar com mais detalhe os atendimentos concluídos.',
            actionPlan: 'Treinamento em gestão de processos no 2º semestre.',
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
              location: `Sede — ${company.tradeName ?? BRAND.companyName}`,
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

    console.info(`Demo documents: ${rendered} of ${documents.length} PDFs rendered.`);
    await removeUnusedPlaceholder(prisma);
  } finally {
    await renderer.onApplicationShutdown();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Demo document rendering failed.', error);
  process.exitCode = 1;
});
