#!/usr/bin/env bash
# Backup Postgres harian. Cron contoh (jam 02:30):
#   30 2 * * * cd /opt/wa-gateway && ./infra/scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; source .env; set +a

mkdir -p backups
FILE="backups/wagw-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner | gzip > "$FILE"
echo "OK $FILE ($(du -h "$FILE" | cut -f1))"

# simpan 14 hari terakhir
find backups -name 'wagw-*.sql.gz' -mtime +14 -delete
