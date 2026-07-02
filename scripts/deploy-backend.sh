#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-invodata-0056}"
REGION="${REGION:-europe-west1}"
SERVICE_NAME="${SERVICE_NAME:-invodata-backend}"
SOURCE_DIR="${SOURCE_DIR:-backend}"

EXTRA_ARGS=()

if [[ -n "${ENV_VARS_FILE:-}" ]]; then
  EXTRA_ARGS+=(--env-vars-file "$ENV_VARS_FILE")
fi

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
  "${EXTRA_ARGS[@]}"
