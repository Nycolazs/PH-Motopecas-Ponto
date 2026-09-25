import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RegulationPayloadDto } from '@ph-ponto/shared';

import { CompanyService } from '../company/company.service.js';
import { PrismaService } from '../database/prisma.service.js';
import type { CompanyRegulationVersion } from '../generated/prisma/client.js';
import type {
  CompanyRegulationResponseDto,
  CompanyRegulationVersionResponseDto,
} from './regulations.dto.js';

@Injectable()
export class RegulationsService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyService) private readonly companyService: CompanyService,
  ) {}

  public async getRegulations(): Promise<CompanyRegulationResponseDto> {
    const company = await this.companyService.getCompany();

    let regulation = await this.prisma.companyRegulation.findUnique({
      where: { companyId: company.id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!regulation) {
      regulation = await this.prisma.companyRegulation.create({
        data: { companyId: company.id },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });
    }

    const currentVersion = regulation.versions[0]
      ? this.serializeVersion(regulation.versions[0])
      : null;

    return {
      id: regulation.id,
      companyId: regulation.companyId,
      currentVersion,
      versions: regulation.versions.map((v) => this.serializeVersion(v)),
      createdAt: regulation.createdAt.toISOString(),
      updatedAt: regulation.updatedAt.toISOString(),
    };
  }

  public async listVersions(): Promise<CompanyRegulationVersionResponseDto[]> {
    const versions = await this.prisma.companyRegulationVersion.findMany({
      orderBy: { versionNumber: 'desc' },
    });

    return versions.map((v) => this.serializeVersion(v));
  }

  public async getVersion(id: string): Promise<CompanyRegulationVersionResponseDto> {
    const version = await this.prisma.companyRegulationVersion.findUnique({
      where: { id },
    });

    if (!version) {
      throw new NotFoundException({
        code: 'REGULATION_VERSION_NOT_FOUND',
        message: 'Versão do regimento interno não encontrada.',
      });
    }

    return this.serializeVersion(version);
  }

  public async isRegulationPublished(): Promise<boolean> {
    const count = await this.prisma.companyRegulationVersion.count();
    return count > 0;
  }

  private serializeVersion(version: CompanyRegulationVersion): CompanyRegulationVersionResponseDto {
    const effectiveDateStr =
      version.effectiveDate instanceof Date
        ? version.effectiveDate.toISOString().slice(0, 10)
        : String(version.effectiveDate);

    return {
      id: version.id,
      companyRegulationId: version.companyRegulationId,
      versionNumber: version.versionNumber,
      title: version.title,
      effectiveDate: effectiveDateStr,
      content: version.content as unknown as RegulationPayloadDto,
      generatedDocumentId: version.generatedDocumentId,
      publishedAt: version.publishedAt.toISOString(),
      createdById: version.createdById,
      createdAt: version.createdAt.toISOString(),
    };
  }
}
