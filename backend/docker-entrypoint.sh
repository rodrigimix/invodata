#!/bin/sh
set -eu

if [ -z "${INVODATA_JWT_SECRET:-}" ]; then
  if command -v openssl >/dev/null 2>&1; then
    export INVODATA_JWT_SECRET="$(openssl rand -hex 32)"
  else
    export INVODATA_JWT_SECRET="$(head -c 32 /dev/urandom | base64 | tr -d '\n' | cut -c1-64)"
  fi
  echo "Generated INVODATA_JWT_SECRET"
fi

exec java -jar /app/app.jar
