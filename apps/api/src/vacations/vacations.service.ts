import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertBusinessDate, compareBusinessDates } from '@ph-ponto/shared';

import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuditAction, AuditTargetType, type Prisma, UserRole } from '../generated/prisma/client.js';
import {
  businessDateToDatabaseDate,
  databaseDateToBusinessDate,
} from '../schedules/business-date.js';
import type { CreateVacationDto, ListVacationsQueryDto } from './vacation.dto.js';
import { toVacationView, type VacationListViewDto, type VacationViewDto } from './vacation.view.js';

@Injectable()
export class VacationsService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  public async create(
    actor: AuthenticatedUser,
    input: CreateVacationDto,
    context: ClientContext,
  ): Promise<VacationViewDto> {
    assertBusinessDate(input.startDate);
    assertBusinessDate(input.endDate);

    if (compareBusinessDates(input.startDate, input.endDate) > 0) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'A data inicial das férias deve ser anterior ou igual à data final.',
      });
    }

    const employee = await this.prisma.user.findUnique({
      where: { id: input.employeeId },
      select: { id: true, name: true, login: true, role: true, isActive: true },
    });

    if (!employee || employee.role !== UserRole.EMPLOYEE) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Colaborador não encontrado.',
      });
    }

    const startDb = businessDateToDatabaseDate(input.startDate);
    const endDb = businessDateToDatabaseDate(input.endDate);

    // Check for overlapping vacations for this employee
    const overlap = await this.prisma.vacation.findFirst({
      where: {
        employeeId: input.employeeId,
        startDate: { lte: endDb },
        endDate: { gte: startDb },
      },
    });

    if (overlap) {
      throw new ConflictException({
        code: 'VACATION_OVERLAP',
        message: `O colaborador já possui férias cadastradas no período de ${databaseDateToBusinessDate(overlap.startDate)} a ${databaseDateToBusinessDate(overlap.endDate)}.`,
      });
    }

    const created = await this.prisma.$transaction(
      async (tx) => {
        const vacation = await tx.vacation.create({
          data: {
            employeeId: input.employeeId,
            startDate: startDb,
            endDate: endDb,
            note: input.note?.trim() || null,
            createdById: actor.id,
          },
          include: {
            employee: { select: { id: true, name: true, login: true } },
            createdBy: { select: { id: true, name: true, login: true } },
          },
        });

        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.VACATION_CREATED,
            targetType: AuditTargetType.VACATION,
            targetId: vacation.id,
            ...context,
            afterState: {
              employeeId: vacation.employeeId,
              employeeName: vacation.employee.name,
              startDate: input.startDate,
              endDate: input.endDate,
              note: vacation.note,
            },
          },
          tx,
        );

        return vacation;
      },
      { isolationLevel: 'Serializable' },
    );

    return toVacationView(created);
  }

  public async list(query: ListVacationsQueryDto): Promise<VacationListViewDto> {
    const where: Prisma.VacationWhereInput = {};

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.from && query.to) {
      where.startDate = { lte: businessDateToDatabaseDate(query.to) };
      where.endDate = { gte: businessDateToDatabaseDate(query.from) };
    } else if (query.from) {
      where.endDate = { gte: businessDateToDatabaseDate(query.from) };
    } else if (query.to) {
      where.startDate = { lte: businessDateToDatabaseDate(query.to) };
    }

    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.vacation.count({ where }),
      this.prisma.vacation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          employee: { select: { id: true, name: true, login: true } },
          createdBy: { select: { id: true, name: true, login: true } },
        },
      }),
    ]);

    return {
      items: items.map(toVacationView),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  public async delete(
    actor: AuthenticatedUser,
    id: string,
    context: ClientContext,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.vacation.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, login: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'VACATION_NOT_FOUND',
        message: 'Registro de férias não encontrado.',
      });
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.vacation.delete({ where: { id } });

        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.VACATION_DELETED,
            targetType: AuditTargetType.VACATION,
            targetId: id,
            ...context,
            beforeState: {
              employeeId: existing.employeeId,
              employeeName: existing.employee.name,
              startDate: databaseDateToBusinessDate(existing.startDate),
              endDate: databaseDateToBusinessDate(existing.endDate),
              note: existing.note,
            },
          },
          tx,
        );
      },
      { isolationLevel: 'Serializable' },
    );

    return { success: true, message: 'Férias canceladas e removidas com sucesso.' };
  }
}
