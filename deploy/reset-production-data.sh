#!/usr/bin/env sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"

if [ "${RESET_SQUADNAV_PRODUCTION:-}" != "DELETE_ALL_SQUADNAV_DATA" ]; then
  echo "Reset cancelled. Set RESET_SQUADNAV_PRODUCTION=DELETE_ALL_SQUADNAV_DATA to continue."
  exit 1
fi

echo "Creating a final database backup..."
./deploy/backup.sh

echo "Deleting all SquadNav users, departments, squads, requests, and push tokens..."
docker compose --env-file deploy/.env -f compose.production.yaml exec -T postgres \
  psql --username blockwatch --dbname blockwatch --set ON_ERROR_STOP=1 \
  --command "TRUNCATE TABLE device_push_tokens, squad_members, department_requests, squads, departments, users CASCADE;"

echo "Deleting cached partners, navigation watches, and live-location state..."
docker compose --env-file deploy/.env -f compose.production.yaml exec -T redis \
  sh -c 'redis-cli -a "$REDIS_PASSWORD" FLUSHDB'

echo "Reapplying the database schema..."
docker compose --env-file deploy/.env -f compose.production.yaml run --rm api npm run migrate

echo "SquadNav production data has been reset."
