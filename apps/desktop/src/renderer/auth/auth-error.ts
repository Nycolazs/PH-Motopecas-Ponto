export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message : '';
  const searchable = `${code} ${message}`;

  if (/INVALID_CREDENTIALS|Login ou senha inválidos/i.test(searchable)) {
    return 'Login ou senha inválidos.';
  }
  if (/RATE_LIMITED|LOGIN_RATE_LIMITED|Muitas tentativas/i.test(searchable)) {
    return 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
  }
  if (/Acesso restrito/i.test(searchable)) {
    return message;
  }
  if (/Usuário inativo/i.test(searchable)) {
    return 'Usuário inativo. Contate o administrador.';
  }
  if (/NETWORK|ECONNREFUSED|Failed to fetch|NetworkError/i.test(searchable)) {
    return 'Não foi possível acessar o servidor. Tente novamente em alguns instantes.';
  }
  if (/AUTH_BRIDGE_UNAVAILABLE/.test(searchable)) {
    return 'A autenticação segura não está disponível neste ambiente.';
  }
  return message || 'Não foi possível entrar. Verifique os dados e tente novamente.';
}
