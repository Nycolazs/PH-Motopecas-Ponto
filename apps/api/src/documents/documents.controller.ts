import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClientContextService } from '../auth/client-context.service.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  GeneratedDocumentResponseDto,
  type ListDocumentsQueryDto,
  type VoidDocumentDto,
  type DocumentListResponseDto,
} from './documents.dto.js';
import { DocumentsService } from './documents.service.js';

@ApiTags('Arquivo de Documentos')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('documents')
export class DocumentsController {
  public constructor(
    @Inject(DocumentsService) private readonly documentsService: DocumentsService,
    @Inject(ClientContextService) private readonly clientContexts: ClientContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar documentos gerados com filtros e paginação' })
  public async listDocuments(
    @Query() query: ListDocumentsQueryDto,
  ): Promise<DocumentListResponseDto> {
    return this.documentsService.listDocuments(query);
  }

  @Get('artifacts/:artifactId/preview')
  @ApiOperation({ summary: 'Visualizar preview do PDF preparado' })
  @ApiProduces('application/pdf')
  public async previewArtifact(
    @Param('artifactId', new ParseUUIDPipe({ version: '4' })) artifactId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, fileSize } = await this.documentsService.getPreviewStream(artifactId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
    res.setHeader('Cache-Control', 'private, no-cache');

    stream.pipe(res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter metadados de documento gerado pelo ID' })
  @ApiOkResponse({ type: GeneratedDocumentResponseDto })
  public async getDocumentById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<GeneratedDocumentResponseDto> {
    return this.documentsService.getDocumentById(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Baixar arquivo PDF de documento oficial' })
  @ApiProduces('application/pdf')
  public async downloadDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, filename, fileSize } = await this.documentsService.getDownloadStream(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-cache');

    stream.pipe(res);
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anular documento oficial emitido' })
  @ApiOkResponse({ type: GeneratedDocumentResponseDto })
  public async voidDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: VoidDocumentDto,
    @Req() request: Request,
  ): Promise<GeneratedDocumentResponseDto> {
    const context = this.clientContexts.fromRequest(request);
    return this.documentsService.voidDocument(user.id, id, input, context);
  }
}
