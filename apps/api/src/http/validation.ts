import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';
import type { ApiProblemDetails } from '@ph-ponto/shared';

function formatConstraintMessage(constraintKey: string, rawMessage: string): string {
  if (constraintKey === 'minLength') {
    const match = rawMessage.match(/longer than or equal to (\d+)/);
    return match ? `Deve conter no mínimo ${match[1]} caracteres.` : 'Tamanho mínimo não atingido.';
  }
  if (constraintKey === 'maxLength') {
    const match = rawMessage.match(/shorter than or equal to (\d+)/);
    return match ? `Deve conter no máximo ${match[1]} caracteres.` : 'Tamanho máximo excedido.';
  }
  if (constraintKey === 'length') {
    const match = rawMessage.match(/between (\d+) and (\d+)/);
    return match ? `Deve ter entre ${match[1]} e ${match[2]} caracteres.` : 'Tamanho inválido.';
  }
  if (constraintKey === 'isString') return 'Deve ser um texto.';
  if (constraintKey === 'isNotEmpty') return 'Campo obrigatório.';
  if (constraintKey === 'isBoolean') return 'Deve ser verdadeiro ou falso.';
  if (constraintKey === 'isInt') return 'Deve ser um número inteiro.';
  if (constraintKey === 'min') {
    const match = rawMessage.match(/not be less than (\d+)/);
    return match ? `Não pode ser menor que ${match[1]}.` : 'Valor abaixo do mínimo.';
  }
  if (constraintKey === 'max') {
    const match = rawMessage.match(/not be greater than (\d+)/);
    return match ? `Não pode ser maior que ${match[1]}.` : 'Valor acima do máximo.';
  }
  if (constraintKey === 'isIso8601') return 'Data e horário em formato inválido.';
  if (constraintKey === 'isUuid') return 'Identificador inválido.';
  if (constraintKey === 'isEnum') return 'Opção selecionada inválida.';
  if (constraintKey === 'matches') return rawMessage;
  if (constraintKey === 'whitelistValidation') return 'Propriedade não permitida.';
  return rawMessage && !rawMessage.includes('must') ? rawMessage : 'Valor inválido.';
}

function collectValidationDetails(errors: ValidationError[], parentPath = ''): ApiProblemDetails {
  return errors.reduce<ApiProblemDetails>((details, error) => {
    const path = parentPath.length === 0 ? error.property : `${parentPath}.${error.property}`;

    if (error.constraints !== undefined) {
      details[path] = Object.entries(error.constraints).map(([key, msg]) =>
        formatConstraintMessage(key, msg),
      );
    }

    if (error.children !== undefined && error.children.length > 0) {
      Object.assign(details, collectValidationDetails(error.children, path));
    }

    return details;
  }, {});
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    stopAtFirstError: false,
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Revise os campos informados.',
        details: collectValidationDetails(errors),
      }),
  });
}
