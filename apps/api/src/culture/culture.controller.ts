import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/auth.decorators.js';
import { UserRole } from '../generated/prisma/client.js';
import { CultureProfileResponseDto } from './culture.dto.js';
import { CultureService } from './culture.service.js';

@ApiTags('Cultura Organizacional')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('culture')
export class CultureController {
  public constructor(@Inject(CultureService) private readonly cultureService: CultureService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar cultura organizacional e histórico de versões publicadas' })
  @ApiOkResponse({ type: CultureProfileResponseDto })
  public async getCulture(): Promise<CultureProfileResponseDto> {
    return this.cultureService.getCultureProfile();
  }
}
