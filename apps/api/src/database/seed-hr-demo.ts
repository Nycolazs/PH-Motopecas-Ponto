import { createHash } from 'node:crypto';
import { argon2id, hash } from 'argon2';
import { CANONICAL_PERFORMANCE_CRITERIA } from '@ph-ponto/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import {
  AcknowledgmentType,
  DisciplinaryActionType,
  DocumentType,
  EmploymentEventType,
  IdempotencyOperation,
  IdempotencyStatus,
  InterviewRecommendation,
  PerformanceClassification,
  Prisma,
  TimePunchKind,
  TimePunchOrigin,
  UserRole,
} from '../generated/prisma/client.js';

const ARGON2ID_POLICY = Object.freeze({
  type: argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
});

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function seedHrDemoData(
  prisma: PrismaClient,
  adminUser: { id: string; name: string },
): Promise<void> {
  const companyId = '10000000-0000-0000-0000-000000000001';

  // 1. Company Singleton
  const company = await prisma.company.upsert({
    where: { id: companyId },
    create: {
      id: companyId,
      legalName: 'HORIZONTE GESTAO E SERVICOS CORPORATIVOS LTDA',
      tradeName: 'Horizonte Soluções',
      cnpj: '12.345.678/0001-90',
      stateRegistration: '250056789',
      email: 'contato@horizontecorp.com.br',
      phone: '(85) 3234-5678',
      addressStreet: 'Avenida Santos Dumont',
      addressNumber: '2500',
      addressNeighborhood: 'Aldeota',
      addressCity: 'Fortaleza',
      addressState: 'CE',
      addressPostalCode: '60356-000',
      primaryContactName: 'Roberto Almeida',
    },
    update: {
      legalName: 'HORIZONTE GESTAO E SERVICOS CORPORATIVOS LTDA',
      tradeName: 'Horizonte Soluções',
      cnpj: '12.345.678/0001-90',
      stateRegistration: '250056789',
      email: 'contato@horizontecorp.com.br',
      phone: '(85) 3234-5678',
      addressStreet: 'Avenida Santos Dumont',
      addressNumber: '2500',
      addressNeighborhood: 'Aldeota',
      addressCity: 'Fortaleza',
      addressState: 'CE',
      addressPostalCode: '60356-000',
      primaryContactName: 'Roberto Almeida',
    },
  });

  // 2. Demo Artifact (for demo generated documents)
  const demoChecksum = sha256('ph-ponto-demo-artifact-content');
  let demoArtifact = await prisma.documentArtifact.findFirst({
    where: { checksumSha256: demoChecksum },
  });
  if (!demoArtifact) {
    demoArtifact = await prisma.documentArtifact.create({
      data: {
        storagePath: 'artifacts/demo/ph-ponto-demo.pdf',
        fileSize: 45678,
        mimeType: 'application/pdf',
        checksumSha256: demoChecksum,
      },
    });
  }

  // 3. Culture Profile & Published Version 1
  let cultureProfile = await prisma.cultureProfile.findUnique({
    where: { companyId: company.id },
  });
  if (!cultureProfile) {
    cultureProfile = await prisma.cultureProfile.create({
      data: { companyId: company.id },
    });
  }

  let cultureDoc = await prisma.generatedDocument.findFirst({
    where: { companyId: company.id, documentType: DocumentType.CULTURE },
  });
  if (!cultureDoc) {
    cultureDoc = await prisma.generatedDocument.create({
      data: {
        companyId: company.id,
        documentType: DocumentType.CULTURE,
        title: 'Manual de Cultura Organizacional e Princípios — Horizonte Soluções',
        authorId: adminUser.id,
        artifactId: demoArtifact.id,
        documentData: {
          companyName: company.tradeName,
          mission:
            'Oferecer soluções corporativas integradas e serviços de gestão com excelência operacional, inovação e confiabilidade.',
        },
        version: 1,
      },
    });
  }

  const existingCultureVersion = await prisma.cultureProfileVersion.findUnique({
    where: {
      cultureProfileId_versionNumber: {
        cultureProfileId: cultureProfile.id,
        versionNumber: 1,
      },
    },
  });
  if (!existingCultureVersion) {
    await prisma.cultureProfileVersion.create({
      data: {
        cultureProfileId: cultureProfile.id,
        versionNumber: 1,
        mission:
          'Oferecer soluções corporativas integradas e serviços de gestão com excelência operacional, inovação e confiabilidade.',
        vision:
          'Ser referência nacional em eficiência operacional, governança corporativa e excelência no atendimento ao cliente.',
        motto: 'Inovação, ética e excelência em cada resultado.',
        values: [
          {
            title: 'Excelência e Qualidade em Primeiro Lugar',
            description:
              'Cada processo e cada entrega impactam diretamente o sucesso dos nossos clientes. Qualidade técnica é inegociável.',
          },
          {
            title: 'Ética, Honestidade e Transparência',
            description:
              'Atuação transparente, consultiva e íntegra. Construímos relacionamentos de confiança duradoura com nossos clientes.',
          },
          {
            title: 'Comprometimento e Agilidade',
            description:
              'Valorizamos o tempo e os objetivos dos nossos parceiros, entregando soluções ágeis sem abrir mão do rigor técnico.',
          },
          {
            title: 'Espírito de Equipe e Cooperação',
            description:
              'Cuidamos uns dos outros, compartilhamos conhecimento e trabalhamos juntos pelo crescimento da empresa.',
          },
        ],
        generatedDocumentId: cultureDoc.id,
        createdById: adminUser.id,
      },
    });
  }

  // 4. Company Regulation & Published Version 1
  let companyRegulation = await prisma.companyRegulation.findUnique({
    where: { companyId: company.id },
  });
  if (!companyRegulation) {
    companyRegulation = await prisma.companyRegulation.create({
      data: { companyId: company.id },
    });
  }

  let regulationDoc = await prisma.generatedDocument.findFirst({
    where: { companyId: company.id, documentType: DocumentType.REGULATION },
  });
  if (!regulationDoc) {
    regulationDoc = await prisma.generatedDocument.create({
      data: {
        companyId: company.id,
        documentType: DocumentType.REGULATION,
        title: 'Regimento Interno e Normas de Conduta — Horizonte Soluções',
        authorId: adminUser.id,
        artifactId: demoArtifact.id,
        documentData: {
          title: 'Regimento Interno Padrão — Horizonte Soluções',
          effectiveDate: '2026-01-01',
        },
        version: 1,
      },
    });
  }

  let regulationVersion = await prisma.companyRegulationVersion.findUnique({
    where: {
      companyRegulationId_versionNumber: {
        companyRegulationId: companyRegulation.id,
        versionNumber: 1,
      },
    },
  });
  if (!regulationVersion) {
    regulationVersion = await prisma.companyRegulationVersion.create({
      data: {
        companyRegulationId: companyRegulation.id,
        versionNumber: 1,
        title: 'Regimento Interno Padrão — Horizonte Soluções',
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
        content: {
          principles:
            'A Horizonte Soluções preza pela ética corporativa, respeito recíproco e zelo pelas informações e recursos da organização.',
          scheduleRules:
            'A jornada contratual padrão é de 44 horas semanais, com registro biométrico/eletrônico obrigatório de todas as marcações.',
          conductRules:
            'Traje profissional adequado ao ambiente corporativo e uso de crachá de identificação nas dependências da empresa.',
          technologyRules:
            'Sistemas informatizados, estações de trabalho e recursos de rede são de uso estritamente corporativo.',
          disciplinaryRules:
            'Descumprimentos sujeitam-se à gradação disciplinar legal: advertência verbal, advertência escrita e suspensão nos termos da CLT.',
        },
        generatedDocumentId: regulationDoc.id,
        createdById: adminUser.id,
      },
    });
  }

  // 5. Job Roles & Published Versions
  const rolesSeed = [
    {
      title: 'Analista de Operações e Processos',
      department: 'Operações e Logística',
      cbo: '2521-05',
      description:
        'Acompanha e executa rotinas operacionais, controle de qualidade de processos, análise de indicadores e suporte técnico aos fluxos internos.',
      responsibilities: [
        'Analisar fluxos operacionais, identificar gargalos e propor melhorias contínuas nos processos da área.',
        'Executar o acompanhamento de pedidos, cronogramas de entrega e conformidade técnica dos serviços prestados.',
        'Operar sistemas de gestão integrada (ERP), painéis de controle e ferramentas corporativas com precisão.',
        'Manter a documentação técnica, relatórios operacionais e estação de trabalho organizados e atualizados.',
      ],
      requirements: [
        'Ensino Superior em andamento ou completo em Administração, Engenharia de Produção, Logística ou áreas correlatas.',
        'Experiência prévia em rotinas administrativas, operacionais ou controle de qualidade.',
        'Domínio do Pacote Office / ferramentas de produtividade e análise de dados.',
      ],
    },
    {
      title: 'Consultor de Atendimento e Negócios',
      department: 'Comercial e Relacionamento',
      cbo: '3541-25',
      description:
        'Realiza atendimento consultivo a clientes corporativos, elabora propostas comerciais, acompanha contratos e gerencia solicitações.',
      responsibilities: [
        'Atender clientes e parceiros comerciais com cordialidade, proatividade e foco em resultados.',
        'Utilizar o sistema CRM para registro de interações, histórico de atendimento e oportunidades de negócio.',
        'Elaborar propostas comerciais, emitir pedidos de serviço e acompanhar o faturamento junto ao financeiro.',
        'Acompanhar indicadores de satisfação (NPS) e pós-venda para fidelização da carteira de clientes.',
      ],
      requirements: [
        'Ensino Médio Completo.',
        'Experiência em atendimento ao cliente, vendas consultivas ou relacionamento comercial.',
        'Boa comunicação interpessoal e experiência em sistemas ERP de vendas.',
      ],
    },
    {
      title: 'Coordenador de Operações e Equipe',
      department: 'Gestão Geral',
      cbo: '1421-05',
      description:
        'Coordena as equipes operacional e comercial, supervisiona metas, prazos de entrega, indicadores de qualidade e clima organizacional.',
      responsibilities: [
        'Distribuir demandas estratégicas, coordenar analistas e consultores e acompanhar metas diárias.',
        'Monitorar indicadores de SLA, prazos contratuais e garantir o padrão de excelência nas entregas.',
        'Zelar pelo cumprimento do regimento interno, políticas de conformidade e boas práticas de governança.',
        'Conduzir avaliações de desempenho periódicas da equipe operacional.',
      ],
      requirements: [
        'Formação superior completa em Administração, Gestão Empresarial, Economia ou áreas correlatas.',
        'Experiência comprovada em liderança de equipes multidisciplinares e gestão por indicadores.',
        'Domínio de atendimento ao cliente e resolução de conflitos técnicos.',
      ],
    },
  ];

  const createdRoles: Array<{
    roleId: string;
    versionId: string;
    title: string;
  }> = [];

  for (const roleDef of rolesSeed) {
    let role = await prisma.jobRole.findFirst({
      where: { title: roleDef.title },
    });
    if (!role) {
      role = await prisma.jobRole.create({
        data: {
          title: roleDef.title,
          department: roleDef.department,
          isActive: true,
        },
      });
    }

    let roleVersion = await prisma.jobRoleVersion.findUnique({
      where: {
        jobRoleId_versionNumber: {
          jobRoleId: role.id,
          versionNumber: 1,
        },
      },
    });
    if (!roleVersion) {
      roleVersion = await prisma.jobRoleVersion.create({
        data: {
          jobRoleId: role.id,
          versionNumber: 1,
          title: roleDef.title,
          cbo: roleDef.cbo,
          description: roleDef.description,
          responsibilities: roleDef.responsibilities,
          requirements: roleDef.requirements,
          createdById: adminUser.id,
        },
      });

      // Create GeneratedDocument for Role Map
      await prisma.generatedDocument.create({
        data: {
          companyId: company.id,
          documentType: DocumentType.ROLE_MAP,
          title: `Descrição de Cargo — ${roleDef.title}`,
          authorId: adminUser.id,
          artifactId: demoArtifact.id,
          documentData: {
            roleTitle: roleDef.title,
            cbo: roleDef.cbo,
            department: roleDef.department,
            version: 1,
          },
          version: 1,
        },
      });
    }

    createdRoles.push({
      roleId: role.id,
      versionId: roleVersion.id,
      title: roleDef.title,
    });
  }

  // 6. Performance Evaluation Criteria (8 canonical criteria)
  const existingCriteria = await prisma.performanceEvaluationCriteria.findFirst({
    where: { companyId: company.id, versionNumber: 1 },
  });
  if (!existingCriteria) {
    await prisma.performanceEvaluationCriteria.create({
      data: {
        companyId: company.id,
        versionNumber: 1,
        isActive: true,
        criteria: [...CANONICAL_PERFORMANCE_CRITERIA] as unknown as Prisma.InputJsonValue,
        createdById: adminUser.id,
      },
    });
  }

  // 7. Synthetic Employees
  const defaultEmployeePassword = await hash('funcionario123', ARGON2ID_POLICY);

  const demoEmployees = [
    {
      name: 'Carlos Eduardo Silva',
      login: 'carlos.silva',
      roleTitle: 'Analista de Operações e Processos',
      cpf: '123.456.789-01',
      rg: '20080102030-4 SSP/CE',
      birthDate: new Date('1994-05-12T00:00:00.000Z'),
      hireDate: new Date('2026-01-15T00:00:00.000Z'),
      phone: '(85) 98765-4321',
      email: 'carlos.silva@horizontecorp.com.br',
      addressStreet: 'Rua São Gonçalo',
      addressNumber: '450',
      addressNeighborhood: 'Parquelândia',
      addressCity: 'Fortaleza',
      addressState: 'CE',
      addressPostalCode: '60455-230',
    },
    {
      name: 'Mariana Costa Lima',
      login: 'mariana.costa',
      roleTitle: 'Consultor de Atendimento e Negócios',
      cpf: '987.654.321-09',
      rg: '20090203040-5 SSP/CE',
      birthDate: new Date('1998-11-23T00:00:00.000Z'),
      hireDate: new Date('2026-02-01T00:00:00.000Z'),
      phone: '(85) 99123-4567',
      email: 'mariana.costa@horizontecorp.com.br',
      addressStreet: 'Rua General Sampaio',
      addressNumber: '1120',
      addressNeighborhood: 'Centro',
      addressCity: 'Fortaleza',
      addressState: 'CE',
      addressPostalCode: '60020-000',
    },
  ];

  for (const empDef of demoEmployees) {
    const normalized = empDef.login.trim().toLowerCase();
    let empUser = await prisma.user.findUnique({
      where: { normalizedLogin: normalized },
    });

    if (!empUser) {
      empUser = await prisma.user.create({
        data: {
          name: empDef.name,
          login: empDef.login,
          normalizedLogin: normalized,
          passwordHash: defaultEmployeePassword,
          role: UserRole.EMPLOYEE,
          isActive: true,
          accessEnabled: true,
        },
      });
    }

    // Profile
    await prisma.employeeProfile.upsert({
      where: { userId: empUser.id },
      create: {
        userId: empUser.id,
        cpf: empDef.cpf,
        rg: empDef.rg,
        birthDate: empDef.birthDate,
        hireDate: empDef.hireDate,
        phone: empDef.phone,
        personalEmail: empDef.email,
        addressStreet: empDef.addressStreet,
        addressNumber: empDef.addressNumber,
        addressNeighborhood: empDef.addressNeighborhood,
        addressCity: empDef.addressCity,
        addressState: empDef.addressState,
        addressPostalCode: empDef.addressPostalCode,
      },
      update: {
        cpf: empDef.cpf,
        rg: empDef.rg,
        birthDate: empDef.birthDate,
        hireDate: empDef.hireDate,
        phone: empDef.phone,
        personalEmail: empDef.email,
        addressStreet: empDef.addressStreet,
        addressNumber: empDef.addressNumber,
        addressNeighborhood: empDef.addressNeighborhood,
        addressCity: empDef.addressCity,
        addressState: empDef.addressState,
        addressPostalCode: empDef.addressPostalCode,
      },
    });

    // Principal Role Assignment
    const matchingRole = createdRoles.find((r) => r.title === empDef.roleTitle);
    if (matchingRole) {
      const existingAssignment = await prisma.employeeRoleAssignment.findFirst({
        where: {
          employeeId: empUser.id,
          jobRoleId: matchingRole.roleId,
          isPrincipal: true,
        },
      });

      if (!existingAssignment) {
        await prisma.employeeRoleAssignment.create({
          data: {
            employeeId: empUser.id,
            jobRoleId: matchingRole.roleId,
            jobRoleVersionId: matchingRole.versionId,
            startDate: empDef.hireDate,
            isPrincipal: true,
            createdById: adminUser.id,
            notes: 'Atribuição inicial de cargo no momento da admissão.',
          },
        });
      }

      // Role Acknowledgment Document & Record
      const existingRoleAck = await prisma.employeeDocumentAcknowledgment.findFirst({
        where: {
          employeeId: empUser.id,
          acknowledgmentType: AcknowledgmentType.ROLE,
        },
      });

      if (!existingRoleAck) {
        const roleAckDoc = await prisma.generatedDocument.create({
          data: {
            companyId: company.id,
            documentType: DocumentType.ACKNOWLEDGMENT_ROLE,
            title: `Termo de Ciência da Descrição de Cargo — ${empDef.name}`,
            employeeId: empUser.id,
            authorId: adminUser.id,
            artifactId: demoArtifact.id,
            documentData: {
              employeeName: empDef.name,
              roleTitle: empDef.roleTitle,
            },
            version: 1,
          },
        });

        await prisma.employeeDocumentAcknowledgment.create({
          data: {
            employeeId: empUser.id,
            acknowledgmentType: AcknowledgmentType.ROLE,
            jobRoleVersionId: matchingRole.versionId,
            generatedDocumentId: roleAckDoc.id,
            createdById: adminUser.id,
          },
        });
      }
    }

    // Regulation Acknowledgment Document & Record
    const existingRegAck = await prisma.employeeDocumentAcknowledgment.findFirst({
      where: {
        employeeId: empUser.id,
        acknowledgmentType: AcknowledgmentType.REGULATION,
      },
    });

    if (!existingRegAck && regulationVersion) {
      const regAckDoc = await prisma.generatedDocument.create({
        data: {
          companyId: company.id,
          documentType: DocumentType.ACKNOWLEDGMENT_REGULATION,
          title: `Termo de Ciência do Regimento Interno — ${empDef.name}`,
          employeeId: empUser.id,
          authorId: adminUser.id,
          artifactId: demoArtifact.id,
          documentData: {
            employeeName: empDef.name,
            regulationTitle: regulationVersion.title,
          },
          version: 1,
        },
      });

      await prisma.employeeDocumentAcknowledgment.create({
        data: {
          employeeId: empUser.id,
          acknowledgmentType: AcknowledgmentType.REGULATION,
          regulationVersionId: regulationVersion.id,
          generatedDocumentId: regAckDoc.id,
          createdById: adminUser.id,
        },
      });
    }

    // Admission Event
    const existingAdmission = await prisma.employmentEvent.findFirst({
      where: {
        employeeId: empUser.id,
        eventType: EmploymentEventType.ADMISSION,
      },
    });
    if (!existingAdmission) {
      await prisma.employmentEvent.create({
        data: {
          employeeId: empUser.id,
          eventType: EmploymentEventType.ADMISSION,
          effectiveDate: empDef.hireDate,
          title: 'Admissão Formal na Empresa',
          description: `Colaborador contratado formalmente sob regime CLT para o cargo de ${empDef.roleTitle}.`,
          createdById: adminUser.id,
        },
      });
    }
  }

  // Ensure ALL active employees have principal role assignments and acknowledgments
  const allActiveEmployees = await prisma.user.findMany({
    where: { role: UserRole.EMPLOYEE, isActive: true },
  });

  const roleByLogin: Record<string, string> = {
    'carlos.silva': 'Analista de Operações e Processos',
    'rafael.mendes': 'Analista de Operações e Processos',
    'mariana.costa': 'Consultor de Atendimento e Negócios',
    'juliana.alves': 'Consultor de Atendimento e Negócios',
    'ana.rocha': 'Consultor de Atendimento e Negócios',
    'bruno.sousa': 'Coordenador de Operações e Equipe',
  };
  for (const emp of allActiveEmployees) {
    const hasPrincipal = await prisma.employeeRoleAssignment.findFirst({
      where: { employeeId: emp.id, isPrincipal: true },
    });
    const desiredTitle = roleByLogin[emp.normalizedLogin];
    const targetRole = createdRoles.find((r) => r.title === desiredTitle) ?? createdRoles[0];
    if (!hasPrincipal && targetRole) {
      await prisma.employeeRoleAssignment.create({
        data: {
          employeeId: emp.id,
          jobRoleId: targetRole.roleId,
          jobRoleVersionId: targetRole.versionId,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          isPrincipal: true,
          createdById: adminUser.id,
          notes: 'Atribuição de cargo assegurada pelo seed demonstrativo.',
        },
      });
    }

    const hasAck = await prisma.employeeDocumentAcknowledgment.findFirst({
      where: { employeeId: emp.id },
    });
    if (!hasAck && regulationVersion) {
      const regDoc = await prisma.generatedDocument.create({
        data: {
          companyId: company.id,
          documentType: DocumentType.ACKNOWLEDGMENT_REGULATION,
          title: `Termo de Ciência do Regimento Interno — ${emp.name}`,
          employeeId: emp.id,
          authorId: adminUser.id,
          artifactId: demoArtifact.id,
          documentData: {
            employeeName: emp.name,
            regulationTitle: regulationVersion.title,
          },
          version: 1,
        },
      });

      await prisma.employeeDocumentAcknowledgment.create({
        data: {
          employeeId: emp.id,
          acknowledgmentType: AcknowledgmentType.REGULATION,
          regulationVersionId: regulationVersion.id,
          generatedDocumentId: regDoc.id,
          createdById: adminUser.id,
        },
      });
    }
  }

  // 8. Hiring Interview (Demo Candidate)
  const existingInterview = await prisma.hiringInterview.findFirst({
    where: { candidateName: 'Lucas Ferreira Rocha' },
  });
  if (!existingInterview && createdRoles[0]) {
    const interviewDoc = await prisma.generatedDocument.create({
      data: {
        companyId: company.id,
        documentType: DocumentType.INTERVIEW,
        title: 'Guia de Entrevista e Avaliação de Candidato — Lucas Ferreira Rocha',
        authorId: adminUser.id,
        artifactId: demoArtifact.id,
        documentData: {
          candidateName: 'Lucas Ferreira Rocha',
          roleTitle: createdRoles[0].title,
          recommendation: 'RECOMMENDED',
        },
        version: 1,
      },
    });

    await prisma.hiringInterview.create({
      data: {
        candidateName: 'Lucas Ferreira Rocha',
        candidateEmail: 'lucas.rocha@email.com',
        candidatePhone: '(85) 99887-1122',
        jobRoleId: createdRoles[0].roleId,
        roleTitle: createdRoles[0].title,
        interviewDate: new Date('2026-02-10T00:00:00.000Z'),
        interviewerName: adminUser.name,
        evaluatorId: adminUser.id,
        recommendation: InterviewRecommendation.RECOMMENDED,
        notes:
          'Candidato demonstrou excelente raciocínio analítico, visão de processos e domínio prático de ferramentas de gestão operacional.',
        scores: {
          experiencia_tecnica: 5,
          seguranca_trabalho: 4,
          comunicacao_equipe: 4,
          postura_etica: 5,
        },
        generatedDocumentId: interviewDoc.id,
      },
    });
  }

  // 9. Sample Performance Review for Carlos Silva
  const carlosUser = await prisma.user.findFirst({
    where: { normalizedLogin: 'carlos.silva' },
  });

  if (carlosUser) {
    const existingReview = await prisma.performanceReview.findFirst({
      where: { employeeId: carlosUser.id, evaluationPeriod: '2026/1 - Primeiro Semestre' },
    });

    if (!existingReview) {
      const reviewDoc = await prisma.generatedDocument.create({
        data: {
          companyId: company.id,
          documentType: DocumentType.PERFORMANCE_REVIEW,
          title: `Avaliação de Desempenho (2026/1) — ${carlosUser.name}`,
          employeeId: carlosUser.id,
          authorId: adminUser.id,
          artifactId: demoArtifact.id,
          documentData: {
            employeeName: carlosUser.name,
            period: '2026/1 - Primeiro Semestre',
            meanScore: 4.63,
            classification: 'EXCELLENT',
          },
          version: 1,
        },
      });

      const criteriaScores = [
        {
          criterionKey: 'PUNCTUALITY_ATTENDANCE',
          criterionTitle: 'Pontualidade e Assiduidade',
          score: 5,
          feedback: 'Sempre pontual no início da jornada.',
        },
        {
          criterionKey: 'PRODUCTIVITY_AGILITY',
          criterionTitle: 'Produtividade e Agilidade',
          score: 4,
          feedback: 'Ótima produtividade nas entregas da área.',
        },
        {
          criterionKey: 'TECHNICAL_KNOWLEDGE',
          criterionTitle: 'Conhecimento Técnico e Qualidade',
          score: 5,
          feedback: 'Excelente domínio dos sistemas e fluxos operacionais.',
        },
        {
          criterionKey: 'TEAMWORK_COOPERATION',
          criterionTitle: 'Trabalho em Equipe e Cooperação',
          score: 5,
          feedback: 'Sempre disposto a orientar os colegas.',
        },
        {
          criterionKey: 'RESPECT_ETHICS',
          criterionTitle: 'Respeito e Conduta Ética',
          score: 5,
          feedback: 'Conduta exemplar com clientes.',
        },
        {
          criterionKey: 'PROACTIVITY_INITIATIVE',
          criterionTitle: 'Proatividade e Iniciativa',
          score: 4,
          feedback: 'Antecipa demandas e otimiza rotinas do setor.',
        },
        {
          criterionKey: 'ORGANIZATION_TOOLS',
          criterionTitle: 'Organização e Ferramentas',
          score: 4,
          feedback: 'Documentação e relatórios sempre impecáveis.',
        },
        {
          criterionKey: 'WORK_SAFETY',
          criterionTitle: 'Segurança do Trabalho',
          score: 5,
          feedback: 'Cumprimento exemplar das normas internas e de segurança.',
        },
      ];

      await prisma.performanceReview.create({
        data: {
          companyId: company.id,
          employeeId: carlosUser.id,
          evaluatorId: adminUser.id,
          evaluationPeriod: '2026/1 - Primeiro Semestre',
          evaluationDate: new Date('2026-06-30T00:00:00.000Z'),
          meanScore: new Prisma.Decimal('4.63'),
          classification: PerformanceClassification.EXCELLENT,
          scores: criteriaScores,
          strengths:
            'Domínio técnico aprofundado dos processos, relacionamento interpessoal exemplar e alto senso de organização.',
          improvements:
            'Aperfeiçoar o detalhamento executivo nos relatórios semanais de acompanhamento.',
          actionPlan:
            'Participar de capacitação avançada em gestão de processos e indicadores (BI) nas próximas semanas.',
          evaluatorComments:
            'Colaborador fundamental para o alto padrão de qualidade e eficiência da equipe.',
          employeeComments: 'Muito satisfeito com o reconhecimento e o ambiente de trabalho.',
          generatedDocumentId: reviewDoc.id,
        },
      });

      // Note on timeline
      await prisma.employmentEvent.create({
        data: {
          employeeId: carlosUser.id,
          eventType: EmploymentEventType.NOTE,
          effectiveDate: new Date('2026-06-30T00:00:00.000Z'),
          title: 'Avaliação de Desempenho 2026/1 Registrada',
          description:
            'Avaliação de desempenho concluída com média 4.63 (Excelente) e documento homologado.',
          createdById: adminUser.id,
        },
      });
    }

    // 10. Sample Disciplinary Action for Carlos Silva
    const existingDiscipline = await prisma.disciplinaryAction.findFirst({
      where: { employeeId: carlosUser.id },
    });

    if (!existingDiscipline) {
      const disciplineDoc = await prisma.generatedDocument.create({
        data: {
          companyId: company.id,
          documentType: DocumentType.DISCIPLINE_VERBAL,
          title: `Registro de Advertência Verbal — ${carlosUser.name}`,
          employeeId: carlosUser.id,
          authorId: adminUser.id,
          artifactId: demoArtifact.id,
          documentData: {
            employeeName: carlosUser.name,
            actionType: 'DISCIPLINE_VERBAL',
            reason: 'Atraso pontual no início do expediente',
          },
          version: 1,
        },
      });

      await prisma.disciplinaryAction.create({
        data: {
          companyId: company.id,
          employeeId: carlosUser.id,
          issuerId: adminUser.id,
          actionType: DisciplinaryActionType.VERBAL_WARNING,
          documentType: DocumentType.DISCIPLINE_VERBAL,
          incidentDate: new Date('2026-03-10T00:00:00.000Z'),
          reason: 'Atraso não justificado no início da jornada matutina',
          details:
            'O colaborador compareceu com 35 minutos de atraso sem comunicação prévia à coordenação da área.',
          internalClauseRef: 'Artigo 12, Parágrafo 2º do Regimento Interno',
          generatedDocumentId: disciplineDoc.id,
        },
      });
    }
  }

  // 11. Sample Time Punches for Recent Business Day (Carlos Silva)
  if (carlosUser) {
    const existingPunch = await prisma.timePunch.findFirst({
      where: { employeeId: carlosUser.id },
    });

    if (!existingPunch) {
      const punchesSchedule = [
        { time: '2026-09-24T11:00:00.000Z', kind: TimePunchKind.CLOCK_IN }, // 08:00 BRT
        { time: '2026-09-24T15:00:00.000Z', kind: TimePunchKind.CLOCK_OUT }, // 12:00 BRT
        { time: '2026-09-24T16:00:00.000Z', kind: TimePunchKind.CLOCK_IN }, // 13:00 BRT
        { time: '2026-09-24T20:00:00.000Z', kind: TimePunchKind.CLOCK_OUT }, // 17:00 BRT
      ];

      for (const p of punchesSchedule) {
        const occurred = new Date(p.time);
        const idempotencyKey = `seed-punch-${carlosUser.id}-${p.time}`;
        const keyH = sha256(idempotencyKey);
        const fp = sha256(`fingerprint-${idempotencyKey}`);

        let idempotency = await prisma.idempotencyRecord.findUnique({
          where: {
            actorId_operation_keyHash: {
              actorId: carlosUser.id,
              operation: IdempotencyOperation.CREATE_TIME_PUNCH,
              keyHash: keyH,
            },
          },
        });

        if (!idempotency) {
          idempotency = await prisma.idempotencyRecord.create({
            data: {
              actorId: carlosUser.id,
              operation: IdempotencyOperation.CREATE_TIME_PUNCH,
              keyHash: keyH,
              requestFingerprint: fp,
              status: IdempotencyStatus.COMPLETED,
              responseStatus: 201,
              responseBody: { success: true },
              expiresAt: new Date(Date.now() + 86400000),
            },
          });
        }

        const existingPunchForIdempotency = await prisma.timePunch.findUnique({
          where: { idempotencyRecordId: idempotency.id },
        });

        if (!existingPunchForIdempotency) {
          await prisma.timePunch.create({
            data: {
              employeeId: carlosUser.id,
              occurredAt: occurred,
              kind: p.kind,
              origin: TimePunchOrigin.EMPLOYEE,
              idempotencyRecordId: idempotency.id,
            },
          });
        }
      }
    }
  }
}
