#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-invodata-0056}"
REGION="${REGION:-europe-west1}"
SERVICE_NAME="${SERVICE_NAME:-invodata-backend}"
SOURCE_DIR="${SOURCE_DIR:-backend}"

EXTRA_ARGS=()
ENV_VARS=()

add_env_var() {
  local name="$1"
  local value="${!name-}"
  if [[ -n "${value:-}" ]]; then
    ENV_VARS+=("${name}=${value}")
  fi
}

if [[ -n "${ENV_VARS_FILE:-}" ]]; then
  EXTRA_ARGS+=(--env-vars-file "$ENV_VARS_FILE")
fi

add_env_var SPRING_PROFILES_ACTIVE
add_env_var SPRING_DATASOURCE_URL
add_env_var SPRING_DATASOURCE_USERNAME
add_env_var SPRING_DATASOURCE_PASSWORD
add_env_var SPRING_DATA_MONGODB_URI

add_env_var INVODATA_PYTHON_API
add_env_var INVODATA_VIES_URL
add_env_var INVODATA_SICAE_URL
add_env_var INVODATA_ADMIN_REGISTRATION_KEY
add_env_var INVODATA_JWT_SECRET
add_env_var INVODATA_JWT_EXPIRATION
add_env_var INVODATA_AI_ENABLE
add_env_var INVODATA_MEDIA_PATH
add_env_var INVODATA_STORAGE_TYPE
add_env_var INVODATA_GCS_BUCKET
add_env_var INVODATA_MAX_UPLOAD
add_env_var INVODATA_UPLOAD_MAX_CONCURRENT

if [[ -n "${MEMORY:-}" ]]; then
  EXTRA_ARGS+=(--memory "$MEMORY")
fi

if [[ -n "${CPU:-}" ]]; then
  EXTRA_ARGS+=(--cpu "$CPU")
fi

if [[ -n "${MIN_INSTANCES:-}" ]]; then
  EXTRA_ARGS+=(--min-instances "$MIN_INSTANCES")
fi

if [[ -n "${MAX_INSTANCES:-}" ]]; then
  EXTRA_ARGS+=(--max-instances "$MAX_INSTANCES")
fi

gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --source "$SOURCE_DIR" \
  --allow-unauthenticated \
  $([[ ${#ENV_VARS[@]} -gt 0 ]] && printf -- '--set-env-vars=%s' "$(IFS=,; echo "${ENV_VARS[*]}")") \
  "${EXTRA_ARGS[@]}"
