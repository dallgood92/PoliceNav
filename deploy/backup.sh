#!/usr/bin/env sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backup_dir=${BLOCKWATCH_BACKUP_DIR:-/var/backups/blockwatch}
timestamp=$(date -u +%Y%m%dT%H%M%SZ)

mkdir -p "$backup_dir"
cd "$project_dir"

docker compose --env-file deploy/.env -f compose.production.yaml exec -T postgres \
  pg_dump --clean --if-exists --username blockwatch blockwatch | gzip > "$backup_dir/postgres-$timestamp.sql.gz"

docker compose --env-file deploy/.env -f compose.production.yaml exec -T redis \
  redis-cli -a "$(sed -n 's/^REDIS_PASSWORD=//p' deploy/.env)" BGSAVE >/dev/null

find "$backup_dir" -type f -name 'postgres-*.sql.gz' -mtime +14 -delete
echo "Backup written to $backup_dir/postgres-$timestamp.sql.gz"
