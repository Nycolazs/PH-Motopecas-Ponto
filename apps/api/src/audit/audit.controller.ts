import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/auth.decorators.js';
import { AuditLogListViewDto, ListAuditLogsQueryDto } from './audit.dto.js';
import { AuditService } from './audit.service.js';

@ApiTags('Auditoria')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('audit-logs')
export class AuditController {
  public constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Lista eventos de auditoria' })
  @ApiQuery({ type: ListAuditLogsQueryDto })
  @ApiOkResponse({ type: AuditLogListViewDto })
  public list(@Query() query: ListAuditLogsQueryDto): Promise<AuditLogListViewDto> {
    return this.auditService.list(query);
  }
}
