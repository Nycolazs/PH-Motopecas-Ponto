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
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CurrentUser, Public } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClientContextService } from '../auth/client-context.service.js';
import { AvatarViewDto, UploadAvatarDto } from './avatar.dto.js';
import { AvatarsService } from './avatars.service.js';

@ApiTags('Avatares')
@Controller('users/:userId/avatar')
export class AvatarsController {
  public constructor(
    @Inject(AvatarsService) private readonly avatars: AvatarsService,
    @Inject(ClientContextService) private readonly clientContext: ClientContextService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Obtém a foto de perfil do usuário' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({ description: 'Fluxo binário da imagem' })
  @ApiNotFoundResponse({ description: 'Avatar não encontrado.' })
  public async get(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, mimeType, checksum, byteSize } = await this.avatars.getAvatarStream(userId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', byteSize);
    res.setHeader('ETag', `"${checksum}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    stream.pipe(res);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Envia ou substitui a foto de perfil' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiBody({ type: UploadAvatarDto })
  @ApiCreatedResponse({ type: AvatarViewDto })
  public async upload(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() input: UploadAvatarDto,
    @Req() request: Request,
  ): Promise<AvatarViewDto> {
    return this.avatars.upload(actor, userId, input, this.clientContext.fromRequest(request));
  }

  @ApiBearerAuth()
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a foto de perfil' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiNoContentResponse()
  public async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.avatars.remove(actor, userId, this.clientContext.fromRequest(request));
  }
}
