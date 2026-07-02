#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
ENV_TEMPLATE="${ENV_TEMPLATE:-$ROOT_DIR/.env.example}"

usage() {
  cat <<'EOF'
Usage:
  setup-podman-home.sh --nfs-server IP --nfs-export PATH --jwt-secret SECRET --admin-password PASS [options]

Required:
  --nfs-server        Synology IP/hostname (example: 192.168.1.20)
  --nfs-export        NFS export path (example: /volume1/invodata)
  --jwt-secret        Value for INVODATA_JWT_SECRET
  --admin-password    Value for ADMIN_STATS_PASSWORD

Optional:
  --domain DOMAIN         Local/public domain for INVODATA_LOCAL_DOMAIN and INVODATA_FRONTEND_URL
  --backup-dir PATH       Backup path (default: /mnt/synology/invodata/backups)
  --container-sock PATH   Podman socket (default: /run/podman/podman.sock)
  --yes                   Overwrite existing .env without prompt
  --skip-checks           Skip podman compose config and backup dry-run

Notes:
  - This script updates/creates .env for Podman deployment.
  - It does not edit /etc/fstab automatically.
EOF
}

NFS_SERVER=""
NFS_EXPORT=""
JWT_SECRET=""
ADMIN_PASSWORD=""
DOMAIN=""
BACKUP_DIR="/mnt/synology/invodata/backups"
CONTAINER_SOCK="/run/podman/podman.sock"
AUTO_YES="false"
SKIP_CHECKS="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --nfs-server)
      NFS_SERVER="${2:-}"
      shift 2
      ;;
    --nfs-export)
      NFS_EXPORT="${2:-}"
      shift 2
      ;;
    --jwt-secret)
      JWT_SECRET="${2:-}"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD="${2:-}"
      shift 2
      ;;
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --backup-dir)
      BACKUP_DIR="${2:-}"
      shift 2
      ;;
    --container-sock)
      CONTAINER_SOCK="${2:-}"
      shift 2
      ;;
    --yes)
      AUTO_YES="true"
      shift
      ;;
    --skip-checks)
      SKIP_CHECKS="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

[[ -n "$NFS_SERVER" ]] || { echo "Missing --nfs-server" >&2; usage; exit 1; }
[[ -n "$NFS_EXPORT" ]] || { echo "Missing --nfs-export" >&2; usage; exit 1; }
[[ -n "$JWT_SECRET" ]] || { echo "Missing --jwt-secret" >&2; usage; exit 1; }
[[ -n "$ADMIN_PASSWORD" ]] || { echo "Missing --admin-password" >&2; usage; exit 1; }
[[ -f "$ENV_TEMPLATE" ]] || { echo "Template not found: $ENV_TEMPLATE" >&2; exit 1; }

if [[ -f "$ENV_FILE" && "$AUTO_YES" != "true" ]]; then
  printf "%s already exists. Overwrite? [y/N]: " "$ENV_FILE"
  read -r answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

cp "$ENV_TEMPLATE" "$ENV_FILE"

set_env() {
  local key="$1"
  local value="$2"
  local escaped_value="${value//\\/\\\\}"
  escaped_value="${escaped_value//&/\\&}"
  escaped_value="${escaped_value//|/\\|}"

  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${escaped_value}|" "$ENV_FILE"
  else
    printf "%s=%s\n" "$key" "$value" >> "$ENV_FILE"
  fi
}

set_env "CONTAINER_CLI" "podman"
set_env "CONTAINER_SOCK" "$CONTAINER_SOCK"
set_env "NFS_SERVER" "$NFS_SERVER"
set_env "NFS_EXPORT" "$NFS_EXPORT"
set_env "BACKUP_DIR" "$BACKUP_DIR"
set_env "MOUNT_CHECK_PATH" "/mnt/synology"
set_env "REQUIRE_MOUNT" "true"
set_env "INVODATA_JWT_SECRET" "$JWT_SECRET"
set_env "ADMIN_STATS_PASSWORD" "$ADMIN_PASSWORD"

if [[ -n "$DOMAIN" ]]; then
  set_env "INVODATA_LOCAL_DOMAIN" "$DOMAIN"
  set_env "INVODATA_FRONTEND_URL" "http://$DOMAIN"
  set_env "VITE_API_URL" "http://$DOMAIN"
  set_env "INVODATA_CORS_ALLOWED_ORIGINS" "http://$DOMAIN"
fi

echo "Updated $ENV_FILE"

if [[ "$SKIP_CHECKS" == "true" ]]; then
  echo "Skipped runtime checks (--skip-checks)"
  exit 0
fi

command -v podman >/dev/null 2>&1 || { echo "podman not found in PATH" >&2; exit 1; }

(
  cd "$ROOT_DIR"
  podman compose --env-file "$ENV_FILE" -f docker-compose.yml -f docker-compose.nfs.yml config >/tmp/invodata-podman-config.yaml
)

echo "Podman compose config validated"

(
  cd "$ROOT_DIR"
  DRY_RUN=true REQUIRE_MOUNT=false bash scripts/backup.sh
)

echo "Backup dry-run validated"
echo "Next step: podman compose -f docker-compose.yml -f docker-compose.nfs.yml up -d --build"

