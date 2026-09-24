const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SYSTEM_DATABASES = new Set(['postgres', 'template0', 'template1']);

export function assertLocalMode(environment) {
  if (environment.NODE_ENV?.trim().toLowerCase() === 'production') {
    throw new Error('Local database commands cannot run with NODE_ENV=production.');
  }
}

function parseUrl(value, label) {
  try {
    return new URL(value);
  } catch {
    // Do not include the input: connection URLs can contain credentials.
    throw new Error(`${label} must be a valid URL.`);
  }
}

export function validateLocalDatabaseUrl(value, { testOnly = false } = {}) {
  const parsed = parseUrl(value, 'Database target');
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Local database commands require a PostgreSQL URL.');
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error('Local database commands only accept literal loopback hosts or localhost.');
  }
  // libpq/pg accept query parameters that can override the hostname in the URL.
  // Local helpers deliberately support only the schema option, never host/options overrides.
  if ([...parsed.searchParams.keys()].some((key) => key !== 'schema')) {
    throw new Error('Local database URLs only support the schema query parameter.');
  }
  if (
    parsed.searchParams.getAll('schema').length > 1 ||
    (parsed.searchParams.get('schema') ?? 'public') !== 'public' ||
    parsed.hash
  ) {
    throw new Error('Local database commands only support the public schema and no URL fragment.');
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error('The local database name is invalid.');
  }
  if (!/^[a-zA-Z0-9_]{1,63}$/.test(databaseName) || SYSTEM_DATABASES.has(databaseName)) {
    throw new Error('Use a dedicated local application database with a safe name.');
  }
  if (testOnly && !/^[a-zA-Z0-9_]+_test$/.test(databaseName)) {
    throw new Error('Refusing to reset a database whose name does not end in _test.');
  }
  return { databaseName, value: parsed.toString() };
}

export function integrationDatabaseTarget(environment) {
  assertLocalMode(environment);
  if (environment.TEST_DATABASE_URL) {
    return validateLocalDatabaseUrl(environment.TEST_DATABASE_URL, { testOnly: true });
  }
  const source = validateLocalDatabaseUrl(
    environment.DATABASE_URL ??
      'postgresql://ph_ponto:ph_ponto_dev@127.0.0.1:55432/ph_ponto?schema=public',
  );
  const target = new URL(source.value);
  target.pathname = `/${source.databaseName.endsWith('_test') ? source.databaseName : `${source.databaseName}_test`}`;
  return validateLocalDatabaseUrl(target.toString(), { testOnly: true });
}

export function assertLocalApiUrl(value) {
  const parsed = parseUrl(value, 'API target');
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !LOOPBACK_HOSTS.has(parsed.hostname) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error('Local database commands require a loopback HTTP API target.');
  }
}
