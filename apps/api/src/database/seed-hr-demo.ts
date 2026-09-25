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
      legalName: 'PH MOTOPECAS E SERVICOS LTDA',
      tradeName: 'PH Motopeças',
      cnpj: '12.345.678/0001-90',
      stateRegistration: '123456789',
      email: 'contato@phmotopecas.com.br',
      phone: '(85) 3234-5678',
      addressStreet: 'Avenida Mister Hull',
      addressNumber: '1234',
      addressNeighborhood: 'Antônio Bezerra',
      addressCity: 'Fortaleza',
      addressState: 'CE',
      addressPostalCode: '60356-000',
      primaryContactName: 'Paulo Henrique Silva',
    },
    update: {
      legalName: 'PH MOTOPECAS E SERVICOS LTDA',
      tradeName: 'PH Motopeças',
      cnpj: '12.345.678/0001-90',
      stateRegistration: '123456789',
      email: 'contato@phmotopecas.com.br',
      phone: '(85) 3234-5678',
      addressStreet: 'Avenida Mister Hull',
      addressNumber: '1234',
      addressNeighborhood: 'Antônio Bezerra',
      addressCity: 'Fortaleza',
      addressState: 'CE',
      addressPostalCode: '60356-000',
      primaryContactName: 'Paulo Henrique Silva',
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
        title: 'Manual de Cultura Organizacional e Princípios — PH Motopeças',
        authorId: adminUser.id,
        artifactId: demoArtifact.id,
        documentData: {
          companyName: company.tradeName,
          mission:
            'Oferecer soluções completas e de máxima confiabilidade em motopeças e serviços mecânicos com excelência e segurança.',
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
          'Oferecer soluções completas e de máxima confiabilidade em motopeças e serviços mecânicos com excelência e segurança.',
        vision:
          'Ser referência regional em agilidade, integridade técnica e satisfação no atendimento ao motociclista.',
        motto: 'Paixão por duas rodas, compromisso com sua segurança.',
        values: [
          {
            title: 'Segurança e Qualidade em Primeiro Lugar',
            description:
              'Cada peça e cada aperto de parafuso impactam diretamente a vida de quem pilota. Rigor técnico é inegociável.',
          },
          {
            title: 'Ética, Honestidade e Transparência',
            description:
              'Diagnósticos mecânicos justos e sinceros. Construímos relacionamentos de confiança duradoura com nossos clientes.',
          },
          {
            title: 'Comprometimento e Agilidade',
            description:
              'Entendemos a importância da motocicleta no dia a dia e no sustento dos nossos clientes. Eficiência sem perda de qualidade.',
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
        title: 'Regimento Interno e Normas de Conduta — PH Motopeças',
        authorId: adminUser.id,
        artifactId: demoArtifact.id,
        documentData: {
          title: 'Regimento Interno Padrão — PH Motopeças',
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
        title: 'Regimento Interno Padrão — PH Motopeças',
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
        content: {
          principles:
            'A PH Motopeças preza pela disciplina operacional, respeito recíproco e uso seguro de ferramentas e veículos de clientes.',
          scheduleRules:
            'A jornada contratual padrão é de 44 horas semanais, com registro biométrico/eletrônico obrigatório de todas as marcações.',
          conductRules:
            'Uso obrigatório de uniforme limpo e botas com biqueira de proteção na oficina mecânica.',
          technologyRules:
            'Sistemas informatizados e ferramentas de diagnóstico eletrônico são de uso estritamente corporativo.',
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
      title: 'Mecânico Geral de Motocicletas',
      department: 'Oficina Mecânica',
      cbo: '9144-05',
      description:
        'Executa manutenção preventiva e corretiva, desmontagem, retífica, regulagem de motores, injeção eletrônica e suspensão de motos.',
      responsibilities: [
        'Diagnosticar falhas mecânicas e elétricas em motocicletas de baixa, média e alta cilindrada.',
        'Executar desmontagem, reparo e remontagem de motores, caixas de câmbio e sistemas de embreagem.',
        'Manusear scanners de injeção eletrônica e ferramentas de precisão com zelo.',
        'Manter o box de serviço limpo, organizado e livre de resíduos de óleos.',
      ],
      requirements: [
        'Ensino Médio Completo e curso técnico profissionalizante em mecânica de motocicletas.',
        'Experiência mínima comprovada de 2 anos em bancada de oficina.',
        'CNH Categoria A ativa.',
      ],
    },
    {
      title: 'Atendente de Balcão e Peças',
      department: 'Comercial e Balcão',
      cbo: '4211-25',
      description:
        'Atende clientes no balcão e telefone, identifica códigos de peças nos catálogos técnicos, realiza vendas e ordens de serviço.',
      responsibilities: [
        'Atender motociclistas e oficinas parceiras com cordialidade e agilidade.',
        'Consultar sistemas de catálogo eletrônico para correta identificação de peças.',
        'Emitir pedidos, notas fiscais e controlar recebimento em caixa.',
        'Auxiliar na conferência e reposição de estoque nas prateleiras.',
      ],
      requirements: [
        'Ensino Médio Completo.',
        'Conhecimento prático em catálogo de peças e modelos de motos nacionais.',
        'Boa comunicação interpessoal e experiência em sistemas ERP de vendas.',
      ],
    },
    {
      title: 'Gerente de Oficina e Operações',
      department: 'Gestão Geral',
      cbo: '1414-10',
      description:
        'Coordena a equipe técnica da oficina mecânica, supervisiona prazos de entrega, qualidade dos serviços e segurança do trabalho.',
      responsibilities: [
        'Distribuir ordens de serviço e coordenar os mecânicos e auxiliares.',
        'Controlar fluxo de veículos, prazos e garantir o padrão de entrega impecável.',
        'Supervisionar o cumprimento das normas de segurança do trabalho e uso de EPIs.',
        'Conduzir avaliações de desempenho periódicas da equipe operacional.',
      ],
      requirements: [
        'Formação superior ou técnica em Gestão Automotiva, Mecânica ou áreas correlatas.',
        'Experiência comprovada em liderança de equipes operacionais de oficina.',
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
      roleTitle: 'Mecânico Geral de Motocicletas',
      cpf: '123.456.789-01',
      rg: '20080102030-4 SSP/CE',
      birthDate: new Date('1994-05-12T00:00:00.000Z'),
      hireDate: new Date('2026-01-15T00:00:00.000Z'),
      phone: '(85) 98765-4321',
      email: 'carlos.silva@phmotopecas.com.br',
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
      roleTitle: 'Atendente de Balcão e Peças',
      cpf: '987.654.321-09',
      rg: '20090203040-5 SSP/CE',
      birthDate: new Date('1998-11-23T00:00:00.000Z'),
      hireDate: new Date('2026-02-01T00:00:00.000Z'),
      phone: '(85) 99123-4567',
      email: 'mariana.costa@phmotopecas.com.br',
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

  for (const emp of allActiveEmployees) {
    const hasPrincipal = await prisma.employeeRoleAssignment.findFirst({
      where: { employeeId: emp.id, isPrincipal: true },
    });
    if (!hasPrincipal && createdRoles[0]) {
      await prisma.employeeRoleAssignment.create({
        data: {
          employeeId: emp.id,
          jobRoleId: createdRoles[0].roleId,
          jobRoleVersionId: createdRoles[0].versionId,
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
          'Candidato demonstrou excelente raciocínio diagnóstico e conhecimento prático em motores 4 tempos e injeção eletrônica de motocicletas.',
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
          feedback: 'Ótima produtividade na bancada.',
        },
        {
          criterionKey: 'TECHNICAL_KNOWLEDGE',
          criterionTitle: 'Conhecimento Técnico e Qualidade',
          score: 5,
          feedback: 'Excelente domínio de motores e injeção.',
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
          feedback: 'Antecipa revisões e organização de peças.',
        },
        {
          criterionKey: 'ORGANIZATION_TOOLS',
          criterionTitle: 'Organização e Ferramentas',
          score: 4,
          feedback: 'Bancada limpa ao final de cada expediente.',
        },
        {
          criterionKey: 'WORK_SAFETY',
          criterionTitle: 'Segurança do Trabalho',
          score: 5,
          feedback: 'Uso constante de botas e óculos de proteção.',
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
            'Domínio técnico aprofundado, relacionamento interpessoal exemplar e zelo com o ferramental da oficina.',
          improvements: 'Aperfeiçoar o preenchimento detalhado do laudo na ordem de serviço.',
          actionPlan:
            'Realizar treinamento de atendimento e software ERP de oficina nas próximas semanas.',
          evaluatorComments: 'Colaborador fundamental para o alto padrão técnico da oficina.',
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
            'O colaborador compareceu com 35 minutos de atraso sem comunicação prévia à liderança da oficina.',
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
