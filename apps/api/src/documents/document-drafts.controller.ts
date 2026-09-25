import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClientContextService } from '../auth/client-context.service.js';
import { DocumentType, UserRole } from '../generated/prisma/client.js';
import { DocumentDraftsService } from './document-drafts.service.js';
import {
  type ConfirmDocumentDraftDto,
  DocumentDraftResponseDto,
  GeneratedDocumentResponseDto,
  type PrepareDocumentDraftDto,
  type SaveDocumentDraftDto,
} from './documents.dto.js';

@ApiTags('Rascunhos de Documentos')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('documents/drafts')
export class DocumentDraftsController {
  public constructor(
    @Inject(DocumentDraftsService) private readonly draftsService: DocumentDraftsService,
    @Inject(ClientContextService) private readonly clientContexts: ClientContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Obter rascunho de documento ativo pelo tipo e colaborador' })
  @ApiQuery({ name: 'documentType', enum: DocumentType })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  @ApiOkResponse({ type: DocumentDraftResponseDto })
  public async getDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Query('documentType') documentType: DocumentType,
    @Query('employeeId') employeeId?: string,
  ): Promise<DocumentDraftResponseDto | null> {
    return this.draftsService.getDraft(user.id, documentType, employeeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter rascunho pelo ID' })
  @ApiOkResponse({ type: DocumentDraftResponseDto })
  public async getDraftById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<DocumentDraftResponseDto> {
    return this.draftsService.getDraftById(user.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salvar ou atualizar rascunho com controle otimista de revisão' })
  @ApiOkResponse({ type: DocumentDraftResponseDto })
  public async saveDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: SaveDocumentDraftDto,
    @Req() request: Request,
  ): Promise<DocumentDraftResponseDto> {
    const context = this.clientContexts.fromRequest(request);
    return this.draftsService.saveDraft(user.id, input, context);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Descartar rascunho' })
  public async discardDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
  ): Promise<{ success: boolean }> {
    const context = this.clientContexts.fromRequest(request);
    return this.draftsService.discardDraft(user.id, id, context);
  }

  @Post(':id/prepare')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar dados e gerar preview do documento em PDF' })
  @ApiOkResponse({ type: DocumentDraftResponseDto })
  public async prepareDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: PrepareDocumentDraftDto,
    @Req() request: Request,
  ): Promise<DocumentDraftResponseDto> {
    const context = this.clientContexts.fromRequest(request);
    return this.draftsService.prepareDraft(user.id, id, input, context);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar e publicar documento gerado a partir do rascunho' })
  @ApiOkResponse({ type: GeneratedDocumentResponseDto })
  public async confirmDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ConfirmDocumentDraftDto,
    @Req() request: Request,
  ): Promise<GeneratedDocumentResponseDto> {
    const context = this.clientContexts.fromRequest(request);
    return this.draftsService.confirmDraft(user.id, id, input, context);
  }
}
