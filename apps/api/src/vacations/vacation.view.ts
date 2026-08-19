import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { databaseDateToBusinessDate } from '../schedules/business-date.js';

export class VacationAuthorViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty()
  public name!: string;

  @ApiProperty()
  public login!: string;
}

export class VacationViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public employeeId!: string;

  @ApiProperty({ type: VacationAuthorViewDto })
  public employee!: VacationAuthorViewDto;

  @ApiProperty({ example: '2026-09-01' })
  public startDate!: string;

  @ApiProperty({ example: '2026-09-30' })
  public endDate!: string;

  @ApiProperty({ description: 'Duração em dias corridos', example: 30 })
  public daysCount!: number;

  @ApiPropertyOptional({ nullable: true })
  public note!: string | null;

  @ApiProperty({ format: 'uuid' })
  public createdById!: string;

  @ApiProperty({ type: VacationAuthorViewDto })
  public createdBy!: VacationAuthorViewDto;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  public updatedAt!: string;
}

export class VacationPaginationViewDto {
  @ApiProperty()
  public page!: number;

  @ApiProperty()
  public limit!: number;

  @ApiProperty()
  public total!: number;

  @ApiProperty()
  public totalPages!: number;
}

export class VacationListViewDto {
  @ApiProperty({ type: [VacationViewDto] })
  public items!: VacationViewDto[];

  @ApiProperty({ type: VacationPaginationViewDto })
  public pagination!: VacationPaginationViewDto;
}

export interface VacationEntity {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  note: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  employee: { id: string; name: string; login: string };
  createdBy: { id: string; name: string; login: string };
}

export function toVacationView(entity: VacationEntity): VacationViewDto {
  const startStr = databaseDateToBusinessDate(entity.startDate);
  const endStr = databaseDateToBusinessDate(entity.endDate);

  const startMs = Date.parse(`${startStr}T00:00:00Z`);
  const endMs = Date.parse(`${endStr}T00:00:00Z`);
  const daysCount = Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);

  return {
    id: entity.id,
    employeeId: entity.employeeId,
    employee: {
      id: entity.employee.id,
      name: entity.employee.name,
      login: entity.employee.login,
    },
    startDate: startStr,
    endDate: endStr,
    daysCount,
    note: entity.note,
    createdById: entity.createdById,
    createdBy: {
      id: entity.createdBy.id,
      name: entity.createdBy.name,
      login: entity.createdBy.login,
    },
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
