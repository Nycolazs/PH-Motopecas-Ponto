#!/bin/sh
set -e

# Run Prisma database migrations automatically on container start
if [ -n "$DATABASE_URL" ]; then
  echo "[PH-Ponto] Checking database connection and applying Prisma migrations..."
  ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma || true
fi

exec "$@"
