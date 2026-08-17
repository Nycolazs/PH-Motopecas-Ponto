import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import {
  AttendanceDateQueryDto,
  AttendanceHistoryQueryDto,
  AttendanceMonthQueryDto,
  AttendanceOverviewQueryDto,
} from './attendance.dto.js';
import { AttendanceService } from './attendance.service.js';
import {
  AttendanceOverviewViewDto,
  AttendancePeriodViewDto,
  DailyAttendanceViewDto,
  MonthlyAttendanceViewDto,
} from './attendance.view.js';

@ApiTags('Frequência')
@ApiBearerAuth()
@Roles('EMPLOYEE')
@Controller('attendance')
export class AttendanceController {
  public constructor(@Inject(AttendanceService) private readonly attendance: AttendanceService) {}

  @Get('today')
  @ApiOperation({ summary: 'Consulta a frequência do funcionário no dia atual' })
  @ApiOkResponse({ type: DailyAttendanceViewDto })
  public today(@CurrentUser() employee: AuthenticatedUser): Promise<DailyAttendanceViewDto> {
    return this.attendance.getToday(employee.id);
  }

  @Get('day')
  @ApiOperation({ summary: 'Consulta a frequência do funcionário em uma data' })
  @ApiQuery({ type: AttendanceDateQueryDto })
  @ApiOkResponse({ type: DailyAttendanceViewDto })
  public day(
    @CurrentUser() employee: AuthenticatedUser,
    @Query() query: AttendanceDateQueryDto,
  ): Promise<DailyAttendanceViewDto> {
    return this.attendance.getDaily(employee.id, query.date);
  }

  @Get('history')
  @ApiOperation({ summary: 'Consulta o histórico do próprio funcionário' })
  @ApiQuery({ type: AttendanceHistoryQueryDto })
  @ApiOkResponse({ type: AttendancePeriodViewDto })
  public history(
    @CurrentUser() employee: AuthenticatedUser,
    @Query() query: AttendanceHistoryQueryDto,
  ): Promise<AttendancePeriodViewDto> {
    return this.attendance.getPeriod(employee.id, query.from, query.to);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Consulta o resumo mensal do próprio funcionário' })
  @ApiQuery({ type: AttendanceMonthQueryDto })
  @ApiOkResponse({ type: MonthlyAttendanceViewDto })
  public monthly(
    @CurrentUser() employee: AuthenticatedUser,
    @Query() query: AttendanceMonthQueryDto,
  ): Promise<MonthlyAttendanceViewDto> {
    return this.attendance.getMonthly(employee.id, query.month);
  }
}

@ApiTags('Frequência administrativa')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('attendance')
export class AdminAttendanceController {
  public constructor(@Inject(AttendanceService) private readonly attendance: AttendanceService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Painel operacional com resumo de presença e batidas em tempo real' })
  @ApiQuery({ type: AttendanceOverviewQueryDto })
  @ApiOkResponse({ type: AttendanceOverviewViewDto })
  public overview(@Query() query: AttendanceOverviewQueryDto): Promise<AttendanceOverviewViewDto> {
    return this.attendance.getOverview(query.date);
  }

  @Get('employees/:employeeId/day')
  @ApiOperation({ summary: 'Consulta a frequência diária de um funcionário' })
  @ApiParam({ name: 'employeeId', format: 'uuid' })
  @ApiQuery({ type: AttendanceDateQueryDto })
  @ApiOkResponse({ type: DailyAttendanceViewDto })
  public day(
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Query() query: AttendanceDateQueryDto,
  ): Promise<DailyAttendanceViewDto> {
    return this.attendance.getAdminDaily(employeeId, query.date);
  }

  @Get('employees/:employeeId/history')
  @ApiOperation({ summary: 'Consulta o histórico de um funcionário' })
  @ApiParam({ name: 'employeeId', format: 'uuid' })
  @ApiQuery({ type: AttendanceHistoryQueryDto })
  @ApiOkResponse({ type: AttendancePeriodViewDto })
  public history(
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Query() query: AttendanceHistoryQueryDto,
  ): Promise<AttendancePeriodViewDto> {
    return this.attendance.getPeriod(employeeId, query.from, query.to);
  }

  @Get('employees/:employeeId/monthly')
  @ApiOperation({ summary: 'Consulta o resumo mensal de um funcionário' })
  @ApiParam({ name: 'employeeId', format: 'uuid' })
  @ApiQuery({ type: AttendanceMonthQueryDto })
  @ApiOkResponse({ type: MonthlyAttendanceViewDto })
  public monthly(
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Query() query: AttendanceMonthQueryDto,
  ): Promise<MonthlyAttendanceViewDto> {
    return this.attendance.getMonthly(employeeId, query.month);
  }
}
