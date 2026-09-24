#!/bin/bash
set -e 

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
set -a
source "$SCRIPT_DIR/../.env"
set +a

echo "Backup MySQL..."

docker exec taxi-mysql \
mysqldump --no-tablespaces -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
> "$REPO_ROOT/mysql/backup/taxi.sql"


gpg --batch \
    --yes \
    --passphrase "$BACKUP_MYSQL" \
    -c \
    -o "$REPO_ROOT/mysql/backup/taxi.sql.gpg" \
    "$REPO_ROOT/mysql/backup/taxi.sql"

rm "$REPO_ROOT/mysql/backup/taxi.sql"

echo "Gotowe."