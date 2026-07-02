#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-invodata-0056}"
REGION="${REGION:-europe-west1}"
SERVICE_NAME="${SERVICE_NAME:-invodata-python-api}"
SOURCE_DIR="${SOURCE_DIR:-api-python}"

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

add_env_var GCP_PROJECT
add_env_var GCP_LOCATION

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
