import { Inject, Injectable } from '@nestjs/common';
import { CompanyService } from '../company/company.service.js';
import { PrismaService } from '../database/prisma.service.js';
import type { CultureProfileVersion } from '../generated/prisma/client.js';
import type {
  CultureProfileResponseDto,
  CultureValueItemDto,
  CultureVersionResponseDto,
} from './culture.dto.js';

@Injectable()
export class CultureService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyService) private readonly companyService: CompanyService,
  ) {}

  public async getCultureProfile(): Promise<CultureProfileResponseDto> {
    const companyDto = await this.companyService.getCompany();

    let profile = await this.prisma.cultureProfile.findUnique({
      where: { companyId: companyDto.id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!profile) {
      profile = await this.prisma.cultureProfile.create({
        data: { companyId: companyDto.id },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });
    }

    const currentVersion = profile.versions[0] ? this.serializeVersion(profile.versions[0]) : null;

    return {
      id: profile.id,
      companyId: profile.companyId,
      currentVersion,
      versions: profile.versions.map((v) => this.serializeVersion(v)),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  public async isCulturePublished(): Promise<boolean> {
    const count = await this.prisma.cultureProfileVersion.count();
    return count > 0;
  }

  private serializeVersion(version: CultureProfileVersion): CultureVersionResponseDto {
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      mission: version.mission,
      vision: version.vision,
      values: version.values as unknown as CultureValueItemDto[],
      motto: version.motto,
      generatedDocumentId: version.generatedDocumentId,
      publishedAt: version.publishedAt.toISOString(),
      createdById: version.createdById,
      createdAt: version.createdAt.toISOString(),
    };
  }
}
