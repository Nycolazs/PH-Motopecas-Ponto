#!/bin/sh
set -e

# Run Prisma database migrations automatically on container start
if [ -n "$DATABASE_URL" ]; then
  echo "[PH-Ponto] Checking database connection and applying Prisma migrations..."
  # Fail loudly: starting the API on a partially migrated schema would corrupt data.
  ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma
fi

exec "$@"
