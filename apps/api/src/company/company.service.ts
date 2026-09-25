import { Inject, Injectable } from '@nestjs/common';
import { COMPANY_NAME } from '@ph-ponto/shared';

import type { ClientContext } from '../auth/auth.types.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditTargetType,
  UserRole,
  type Company,
} from '../generated/prisma/client.js';
import type {
  CompanyResponseDto,
  SetupStatusResponseDto,
  UpdateCompanyRequestDto,
} from './company.dto.js';

const DEFAULT_COMPANY_ID = '10000000-0000-0000-0000-000000000001';

@Injectable()
export class CompanyService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  public async getCompany(): Promise<CompanyResponseDto> {
    let company = await this.prisma.company.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!company) {
      company = await this.prisma.company.create({
        data: {
          id: DEFAULT_COMPANY_ID,
          legalName: `${COMPANY_NAME.toUpperCase()} LTDA`,
          tradeName: COMPANY_NAME,
          cnpj: '00.000.000/0001-00',
        },
      });
    }

    return this.serializeCompany(company);
  }

  public async updateCompany(
    actorId: string,
    input: UpdateCompanyRequestDto,
    context: ClientContext,
  ): Promise<CompanyResponseDto> {
    const existing = await this.getCompany();

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.company.update({
        where: { id: existing.id },
        data: {
          legalName: input.legalName.trim(),
          tradeName: input.tradeName.trim(),
          cnpj: input.cnpj.trim(),
          stateRegistration: input.stateRegistration?.trim() || null,
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          addressStreet: input.addressStreet?.trim() || null,
          addressNumber: input.addressNumber?.trim() || null,
          addressComplement: input.addressComplement?.trim() || null,
          addressNeighborhood: input.addressNeighborhood?.trim() || null,
          addressCity: input.addressCity?.trim() || null,
          addressState: input.addressState?.trim().toUpperCase() || null,
          addressPostalCode: input.addressPostalCode?.trim() || null,
          primaryContactName: input.primaryContactName?.trim() || null,
        },
      });

      await this.audit.record(
        {
          actorId,
          action: AuditAction.COMPANY_UPDATED,
          targetType: AuditTargetType.COMPANY,
          targetId: saved.id,
          ...context,
          beforeState: {
            legalName: existing.legalName,
            tradeName: existing.tradeName,
            cnpj: existing.cnpj,
          },
          afterState: {
            legalName: saved.legalName,
            tradeName: saved.tradeName,
            cnpj: saved.cnpj,
          },
        },
        tx,
      );

      return saved;
    });

    return this.serializeCompany(updated);
  }

  public async getSetupStatus(): Promise<SetupStatusResponseDto> {
    const company = await this.prisma.company.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    const isCompanyComplete = Boolean(
      company &&
      company.cnpj !== '00.000.000/0001-00' &&
      company.legalName &&
      company.tradeName &&
      company.addressCity &&
      company.addressState,
    );

    const activeRolesCount = await this.prisma.jobRole.count({
      where: { isActive: true },
    });

    const publishedRolesCount = await this.prisma.jobRoleVersion.count();

    const isRolePublished = activeRolesCount > 0 && publishedRolesCount > 0;

    const activeEmployeesCount = await this.prisma.user.count({
      where: { role: UserRole.EMPLOYEE, isActive: true },
    });

    const hasActiveEmployee = activeEmployeesCount > 0;

    const employeesWithRoleCount = await this.prisma.employeeRoleAssignment.groupBy({
      by: ['employeeId'],
      where: {
        isPrincipal: true,
        employee: { isActive: true },
      },
    });

    const allAssignedRoles =
      hasActiveEmployee && employeesWithRoleCount.length >= activeEmployeesCount;

    const cultureVersionsCount = await this.prisma.cultureProfileVersion.count();
    const isCulturePublished = cultureVersionsCount > 0;
    const isRegulationPublished = false;

    const items = [
      {
        id: 'company',
        label: 'Dados da Empresa',
        description: 'Cadastrar razão social, CNPJ e endereço oficial',
        isCompleted: isCompanyComplete,
        actionUrl: '/admin/empresa',
      },
      {
        id: 'roles',
        label: 'Cargos e Funções',
        description: 'Definir cargos e publicar descrição de atividades',
        isCompleted: isRolePublished,
        actionUrl: '/admin/cargos',
      },
      {
        id: 'culture',
        label: 'Cultura e Valores',
        description: 'Publicar missão, visão e valores da organização',
        isCompleted: isCulturePublished,
        actionUrl: '/admin/documentos/cultura',
      },
      {
        id: 'regulation',
        label: 'Regimento Interno',
        description: 'Criar e publicar as regras e políticas de trabalho',
        isCompleted: isRegulationPublished,
        actionUrl: '/admin/documentos/regimento',
      },
      {
        id: 'employee',
        label: 'Primeiro Colaborador',
        description: 'Cadastrar colaboradores ativos na empresa',
        isCompleted: hasActiveEmployee,
        actionUrl: '/admin/funcionarios',
      },
      {
        id: 'assignment',
        label: 'Atribuição de Cargos',
        description: 'Vincular todos os colaboradores aos seus respectivos cargos',
        isCompleted: allAssignedRoles,
        actionUrl: '/admin/funcionarios',
      },
    ];

    const completedCount = items.filter((i) => i.isCompleted).length;
    const completionPercentage = Math.round((completedCount / items.length) * 100);

    return {
      completionPercentage,
      items,
    };
  }

  private serializeCompany(company: Company): CompanyResponseDto {
    return {
      id: company.id,
      legalName: company.legalName,
      tradeName: company.tradeName,
      cnpj: company.cnpj,
      stateRegistration: company.stateRegistration,
      email: company.email,
      phone: company.phone,
      addressStreet: company.addressStreet,
      addressNumber: company.addressNumber,
      addressComplement: company.addressComplement,
      addressNeighborhood: company.addressNeighborhood,
      addressCity: company.addressCity,
      addressState: company.addressState,
      addressPostalCode: company.addressPostalCode,
      primaryContactName: company.primaryContactName,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    };
  }
}
