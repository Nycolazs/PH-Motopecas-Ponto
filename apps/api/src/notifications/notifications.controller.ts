import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClientContextService } from '../auth/client-context.service.js';
import {
  LateArrivalSettingsViewDto,
  NotificationOutboxViewDto,
  NotificationRecipientViewDto,
  NotificationSettingsViewDto,
  UpdateLateArrivalSettingsDto,
  UpdateNotificationRecipientDto,
  WhatsappQrViewDto,
  WhatsappStatusViewDto,
} from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notificações por WhatsApp')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('notifications')
export class NotificationsController {
  public constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(ClientContextService) private readonly clientContext: ClientContextService,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'Configuração de WhatsApp, alerta de atraso e destinatários' })
  @ApiOkResponse({ type: NotificationSettingsViewDto })
  public async settings(): Promise<NotificationSettingsViewDto> {
    const [whatsapp, lateArrival, recipients] = await Promise.all([
      this.notifications.whatsappStatus(),
      this.notifications.getLateArrivalSettings(),
      this.notifications.listRecipients(),
    ]);
    return { whatsapp, lateArrival, recipients };
  }

  @Put('late-arrival')
  @ApiOperation({ summary: 'Atualiza o alerta de atraso (ativo e tolerância)' })
  @ApiBody({ type: UpdateLateArrivalSettingsDto })
  @ApiOkResponse({ type: LateArrivalSettingsViewDto })
  public updateLateArrival(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: UpdateLateArrivalSettingsDto,
    @Req() request: Request,
  ): Promise<LateArrivalSettingsViewDto> {
    return this.notifications.updateLateArrivalSettings(
      actor,
      { enabled: input.enabled, toleranceMinutes: input.toleranceMinutes },
      this.clientContext.fromRequest(request),
    );
  }

  @Put('recipients/:userId')
  @ApiOperation({ summary: 'Define o WhatsApp e os alertas de um administrador' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiBody({ type: UpdateNotificationRecipientDto })
  @ApiOkResponse({ type: NotificationRecipientViewDto })
  public updateRecipient(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() input: UpdateNotificationRecipientDto,
    @Req() request: Request,
  ): Promise<NotificationRecipientViewDto> {
    return this.notifications.updateRecipient(
      actor,
      userId,
      { whatsappPhone: input.whatsappPhone ?? null, lateArrivalAlerts: input.lateArrivalAlerts },
      this.clientContext.fromRequest(request),
    );
  }

  @Post('recipients/:userId/test')
  @HttpCode(204)
  @ApiOperation({ summary: 'Envia uma mensagem de teste para o administrador' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiNoContentResponse()
  public sendTest(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    return this.notifications.sendTestMessage(actor, userId);
  }

  @Get('whatsapp/status')
  @ApiOperation({ summary: 'Estado da conexão do WhatsApp' })
  @ApiOkResponse({ type: WhatsappStatusViewDto })
  public status(): Promise<WhatsappStatusViewDto> {
    return this.notifications.whatsappStatus();
  }

  @Post('whatsapp/connect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicia a conexão e gera o QR Code para parear o WhatsApp' })
  @ApiOkResponse({ type: WhatsappStatusViewDto })
  public connect(
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<WhatsappStatusViewDto> {
    return this.notifications.connectWhatsapp(actor, this.clientContext.fromRequest(request));
  }

  @Get('whatsapp/qr')
  @ApiOperation({ summary: 'QR Code atual para parear o WhatsApp' })
  @ApiOkResponse({ type: WhatsappQrViewDto })
  public qr(): Promise<WhatsappQrViewDto> {
    return this.notifications.whatsappQrCode();
  }

  @Post('whatsapp/disconnect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Desconecta o número de WhatsApp' })
  @ApiOkResponse({ type: WhatsappStatusViewDto })
  public disconnect(
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<WhatsappStatusViewDto> {
    return this.notifications.disconnectWhatsapp(actor, this.clientContext.fromRequest(request));
  }

  @Get('outbox')
  @ApiOperation({ summary: 'Últimas mensagens enviadas ou pendentes' })
  @ApiOkResponse({ type: [NotificationOutboxViewDto] })
  public outbox(): Promise<NotificationOutboxViewDto[]> {
    return this.notifications.listRecentNotifications(30);
  }
}
