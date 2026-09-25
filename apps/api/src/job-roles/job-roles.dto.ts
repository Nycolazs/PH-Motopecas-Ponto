import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateJobRoleDto {
  @ApiProperty({ description: 'Título do cargo', example: 'Mecânico de Motos' })
  @IsString()
  @IsNotEmpty({ message: 'O título do cargo é obrigatório.' })
  @MinLength(2, { message: 'O título do cargo deve ter pelo menos 2 caracteres.' })
  @MaxLength(120, { message: 'O título do cargo deve ter no máximo 120 caracteres.' })
  public title!: string;

  @ApiPropertyOptional({ description: 'Departamento / Setor', example: 'Oficina' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'O departamento deve ter no máximo 100 caracteres.' })
  public department?: string | null;

  @ApiPropertyOptional({ description: 'Código CBO', example: '9144-05' })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'O CBO deve ter no máximo 20 caracteres.' })
  public cbo?: string | null;

  @ApiProperty({
    description: 'Descrição sumária das atribuições do cargo',
    example: 'Executa manutenção preventiva e corretiva em motocicletas.',
  })
  @IsString()
  @IsNotEmpty({ message: 'A descrição do cargo é obrigatória.' })
  @MinLength(10, { message: 'A descrição deve ter pelo menos 10 caracteres.' })
  public description!: string;

  @ApiPropertyOptional({
    description: 'Lista de responsabilidades e tarefas principais',
    example: ['Diagnosticar falhas em motores', 'Trocar peças desgastadas'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public responsibilities?: string[];

  @ApiPropertyOptional({
    description: 'Requisitos de formação, experiência ou habilidades',
    example: ['Ensino Médio completo', 'Curso técnico em mecânica de motos'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public requirements?: string[];
}

export class UpdateJobRoleDto {
  @ApiPropertyOptional({ description: 'Título do cargo' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'O título do cargo deve ter pelo menos 2 caracteres.' })
  @MaxLength(120, { message: 'O título do cargo deve ter no máximo 120 caracteres.' })
  public title?: string;

  @ApiPropertyOptional({ description: 'Departamento / Setor' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public department?: string | null;

  @ApiPropertyOptional({ description: 'Status ativo do cargo' })
  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;
}

export class CreateJobRoleVersionDto {
  @ApiPropertyOptional({ description: 'Título específico desta versão' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  public title?: string;

  @ApiPropertyOptional({ description: 'Código CBO' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  public cbo?: string | null;

  @ApiProperty({ description: 'Descrição das atribuições' })
  @IsString()
  @IsNotEmpty({ message: 'A descrição é obrigatória.' })
  @MinLength(10, { message: 'A descrição deve ter pelo menos 10 caracteres.' })
  public description!: string;

  @ApiPropertyOptional({ description: 'Lista de responsabilidades', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public responsibilities?: string[];

  @ApiPropertyOptional({ description: 'Lista de requisitos', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public requirements?: string[];
}

export class AssignEmployeeRoleDto {
  @ApiProperty({ description: 'ID do cargo a ser atribuído', format: 'uuid' })
  @IsUUID('4', { message: 'ID do cargo inválido.' })
  public jobRoleId!: string;

  @ApiPropertyOptional({
    description: 'ID da versão específica do cargo (opcional; se omitido, usa a mais recente)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID da versão do cargo inválido.' })
  public jobRoleVersionId?: string;

  @ApiProperty({ description: 'Data de início (AAAA-MM-DD)', example: '2024-01-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de início deve estar no formato AAAA-MM-DD.' })
  public startDate!: string;

  @ApiPropertyOptional({ description: 'Data de término (AAAA-MM-DD)', example: '2025-01-10' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de término deve estar no formato AAAA-MM-DD.' })
  public endDate?: string | null;

  @ApiPropertyOptional({
    description: 'Indica se é o cargo principal do colaborador',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  public isPrincipal?: boolean;

  @ApiPropertyOptional({
    description: 'Observações sobre a atribuição',
    example: 'Promoção interna',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public notes?: string | null;
}

export class JobRoleVersionResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public jobRoleId!: string;

  @ApiProperty({ example: 1 })
  public versionNumber!: number;

  @ApiProperty({ example: 'Mecânico de Motos' })
  public title!: string;

  @ApiPropertyOptional({ example: '9144-05' })
  public cbo?: string | null;

  @ApiProperty()
  public description!: string;

  @ApiProperty({ type: [String] })
  public responsibilities!: string[];

  @ApiProperty({ type: [String] })
  public requirements!: string[];

  @ApiProperty({ format: 'uuid' })
  public createdById!: string;

  @ApiProperty()
  public createdAt!: string;

  @ApiProperty()
  public publishedAt!: string;
}

export class JobRoleResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: 'Mecânico de Motos' })
  public title!: string;

  @ApiPropertyOptional({ example: 'Oficina' })
  public department?: string | null;

  @ApiProperty()
  public isActive!: boolean;

  @ApiProperty()
  public createdAt!: string;

  @ApiProperty()
  public updatedAt!: string;

  @ApiPropertyOptional({ type: JobRoleVersionResponseDto })
  public currentVersion?: JobRoleVersionResponseDto | null;

  @ApiPropertyOptional({ type: [JobRoleVersionResponseDto] })
  public versions?: JobRoleVersionResponseDto[];

  @ApiPropertyOptional({ example: 3 })
  public activeEmployeesCount?: number;
}

export class EmployeeRoleAssignmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public employeeId!: string;

  @ApiProperty({ format: 'uuid' })
  public jobRoleId!: string;

  @ApiProperty({ format: 'uuid' })
  public jobRoleVersionId!: string;

  @ApiProperty({ example: 'Mecânico de Motos' })
  public roleTitle!: string;

  @ApiProperty({ example: 1 })
  public versionNumber!: number;

  @ApiProperty({ example: '2024-01-10' })
  public startDate!: string;

  @ApiPropertyOptional({ example: '2025-01-10' })
  public endDate?: string | null;

  @ApiProperty({ example: true })
  public isPrincipal!: boolean;

  @ApiPropertyOptional()
  public notes?: string | null;

  @ApiProperty()
  public createdAt!: string;
}
