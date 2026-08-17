import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??=
  'postgresql://ph_ponto:ph_ponto_dev@127.0.0.1:55432/ph_ponto_test?schema=public';
process.env.API_BASE_URL ??= 'http://localhost:3333';
process.env.JWT_SECRET ??= 'test-access-secret-with-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-with-at-least-32-characters';
process.env.INITIAL_ADMIN_USERNAME ??= 'admin';
process.env.INITIAL_ADMIN_PASSWORD ??= 'test-bootstrap-password';
process.env.AUTH_LOGIN_MAX_ATTEMPTS ??= '3';
process.env.UPLOAD_DIR ??= join(tmpdir(), 'ph-ponto-api-integration-uploads');
process.env.SWAGGER_ENABLED ??= 'false';
process.env.APP_TIMEZONE = 'America/Fortaleza';
