import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/auth.decorators.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  HiringInterviewResponseDto,
  ListInterviewsQueryDto,
  PaginatedInterviewsResponseDto,
} from './interviews.dto.js';
import { InterviewsService } from './interviews.service.js';

@ApiTags('Entrevistas de Contratação')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('interviews')
export class InterviewsController {
  public constructor(
    @Inject(InterviewsService) private readonly interviewsService: InterviewsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar entrevistas de contratação registradas' })
  @ApiOkResponse({ type: PaginatedInterviewsResponseDto })
  public async listInterviews(
    @Query() query: ListInterviewsQueryDto,
  ): Promise<PaginatedInterviewsResponseDto> {
    return this.interviewsService.listInterviews(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalhes de uma entrevista de contratação por ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: HiringInterviewResponseDto })
  public async getInterview(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<HiringInterviewResponseDto> {
    return this.interviewsService.getInterview(id);
  }
}
