#!/bin/bash
set -e 

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$SCRIPT_DIR/../.env"
set +a

echo "Backup MySQL..."

docker exec taxi-mysql \
mysqldump --no-tablespaces -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
> mysql/backup/taxi.sql


gpg --batch \
    --yes \
    --passphrase "$BACKUP_MYSQL" \
    -c \
    -o mysql/backup/taxi.sql.gpg \
    mysql/backup/taxi.sql

rm mysql/backup/taxi.sql

echo "Gotowe."