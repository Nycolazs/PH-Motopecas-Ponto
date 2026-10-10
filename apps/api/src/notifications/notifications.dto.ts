import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLateArrivalSettingsDto {
  @ApiProperty({ description: 'Envia alertas de atraso pelo WhatsApp.' })
  @IsBoolean()
  public enabled!: boolean;
}

export class UpdateNotificationRecipientDto {
  @ApiPropertyOptional({
    nullable: true,
    example: '(85) 99999-0000',
    description: 'WhatsApp do administrador com DDD. Vazio remove o contato.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  public whatsappPhone!: string | null;

  @ApiProperty({ description: 'Recebe alertas de atraso dos colaboradores.' })
  @IsBoolean()
  public lateArrivalAlerts!: boolean;
}

export class LateArrivalSettingsViewDto {
  @ApiProperty() public enabled!: boolean;
  @ApiProperty({
    description: 'Tolerância do Regimento Interno vigente (ou o padrão de 5 minutos).',
  })
  public toleranceMinutes!: number;
  @ApiProperty({ enum: ['REGULATION', 'DEFAULT'] }) public source!: 'REGULATION' | 'DEFAULT';
  @ApiPropertyOptional({ nullable: true }) public regulationVersion!: number | null;
}

export class WhatsappStatusViewDto {
  @ApiProperty({
    enum: [
      'NOT_CONFIGURED',
      'UNAVAILABLE',
      'DISCONNECTED',
      'CONNECTING',
      'WAITING_QR',
      'CONNECTED',
      'ERROR',
    ],
  })
  public state!: string;

  @ApiPropertyOptional({ nullable: true }) public phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) public connectedAt!: string | null;
}

export class WhatsappQrViewDto {
  @ApiPropertyOptional({ nullable: true, description: 'Imagem PNG em data URL.' })
  public qrCode!: string | null;

  @ApiProperty({ type: WhatsappStatusViewDto }) public status!: WhatsappStatusViewDto;
}

export class NotificationRecipientViewDto {
  @ApiProperty({ format: 'uuid' }) public userId!: string;
  @ApiProperty() public name!: string;
  @ApiProperty() public login!: string;
  @ApiPropertyOptional({ nullable: true }) public whatsappPhone!: string | null;
  @ApiProperty() public lateArrivalAlerts!: boolean;
}

export class NotificationOutboxViewDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiProperty({ enum: ['LATE_ARRIVAL', 'TEST'] }) public kind!: string;
  @ApiProperty({ enum: ['PENDING', 'SENT', 'FAILED'] }) public status!: string;
  @ApiPropertyOptional({ nullable: true }) public recipientName!: string | null;
  @ApiPropertyOptional({ nullable: true }) public subjectName!: string | null;
  @ApiProperty() public phone!: string;
  @ApiProperty() public message!: string;
  @ApiProperty() public attempts!: number;
  @ApiPropertyOptional({ nullable: true }) public lastError!: string | null;
  @ApiProperty() public createdAt!: string;
  @ApiPropertyOptional({ nullable: true }) public sentAt!: string | null;
}

export class NotificationSettingsViewDto {
  @ApiProperty({ type: WhatsappStatusViewDto }) public whatsapp!: WhatsappStatusViewDto;
  @ApiProperty({ type: LateArrivalSettingsViewDto })
  public lateArrival!: LateArrivalSettingsViewDto;
  @ApiProperty({ type: [NotificationRecipientViewDto] })
  public recipients!: NotificationRecipientViewDto[];
}
