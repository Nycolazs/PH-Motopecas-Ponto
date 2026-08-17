export function normalizeLogin(login: string): string {
  return login.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
}
