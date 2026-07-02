#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/mnt/synology/invodata/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MOUNT_CHECK_PATH="${MOUNT_CHECK_PATH:-/mnt/synology}"
REQUIRE_MOUNT="${REQUIRE_MOUNT:-true}"
DRY_RUN="${DRY_RUN:-false}"
CONTAINER_CLI="${CONTAINER_CLI:-docker}"

MARIADB_CONTAINER="${MARIADB_CONTAINER:-invodata-mariadb}"
MARIADB_DATABASE="${MARIADB_DATABASE:-invodata}"
MARIADB_USER="${MARIADB_USER:-invodata}"
MARIADB_PASSWORD="${MARIADB_PASSWORD:-}"
MARIADB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD:-}"

INCLUDE_MONGODB="${INCLUDE_MONGODB:-false}"
MONGODB_CONTAINER="${MONGODB_CONTAINER:-invodata-mongodb}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
MARIADB_BACKUP="$BACKUP_DIR/mariadb_${MARIADB_DATABASE}_${TIMESTAMP}.sql.gz"
MARIADB_TMP="$MARIADB_BACKUP.tmp"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

container_exec() {
  "$CONTAINER_CLI" exec "$@"
}

command -v "$CONTAINER_CLI" >/dev/null 2>&1 || fail "Container CLI '$CONTAINER_CLI' not found"

dump_mariadb() {
  if [[ -n "$MARIADB_PASSWORD" ]]; then
    container_exec -e MYSQL_PWD="$MARIADB_PASSWORD" "$MARIADB_CONTAINER" \
      mariadb-dump -u "$MARIADB_USER" --single-transaction --quick --lock-tables=false "$MARIADB_DATABASE"
    return
  fi

  if [[ -n "$MARIADB_ROOT_PASSWORD" ]]; then
    container_exec -e MYSQL_PWD="$MARIADB_ROOT_PASSWORD" "$MARIADB_CONTAINER" \
      mariadb-dump -u root --single-transaction --quick --lock-tables=false "$MARIADB_DATABASE"
    return
  fi

  container_exec "$MARIADB_CONTAINER" \
    mariadb-dump -u "$MARIADB_USER" --single-transaction --quick --lock-tables=false "$MARIADB_DATABASE"
}

[[ "$REQUIRE_MOUNT" == "false" ]] || mountpoint -q "$MOUNT_CHECK_PATH" || fail "Mount path '$MOUNT_CHECK_PATH' is not mounted"

mkdir -p "$BACKUP_DIR"

log "Starting backup in $BACKUP_DIR"

if [[ "$DRY_RUN" == "true" ]]; then
  log "DRY_RUN: would create MariaDB dump at $MARIADB_BACKUP"
else
  dump_mariadb | gzip -9 > "$MARIADB_TMP"
  gzip -t "$MARIADB_TMP"
  mv "$MARIADB_TMP" "$MARIADB_BACKUP"
  log "MariaDB backup created: $MARIADB_BACKUP"
fi

if [[ "$INCLUDE_MONGODB" == "true" ]]; then
  MONGODB_BACKUP="$BACKUP_DIR/mongodb_${TIMESTAMP}.archive.gz"
  MONGODB_TMP="$MONGODB_BACKUP.tmp"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY_RUN: would create MongoDB dump at $MONGODB_BACKUP"
  else
    container_exec "$MONGODB_CONTAINER" mongodump --archive | gzip -9 > "$MONGODB_TMP"
    gzip -t "$MONGODB_TMP"
    mv "$MONGODB_TMP" "$MONGODB_BACKUP"
    log "MongoDB backup created: $MONGODB_BACKUP"
  fi
fi

if [[ "$DRY_RUN" == "true" ]]; then
  log "DRY_RUN: would prune backup files older than $RETENTION_DAYS days"
else
  find "$BACKUP_DIR" -type f -name "*.gz" -mtime "+$RETENTION_DAYS" -print -delete
fi

log "Backup job completed"
