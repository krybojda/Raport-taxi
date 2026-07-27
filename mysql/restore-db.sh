#!/bin/bash

set -e 

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
set -a
source "$SCRIPT_DIR/../.env"
set +a
echo "Odszyfrowanie bazy..."

gpg --batch \
--yes \
--passphrase "$BACKUP_MYSQL" \
-d \
-o "$REPO_ROOT/mysql/backup/taxi.sql" \
"$REPO_ROOT/mysql/backup/taxi.sql.gpg"


echo "Import..."

docker exec -i taxi-mysql \
mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
< "$REPO_ROOT/mysql/backup/taxi.sql"


rm "$REPO_ROOT/mysql/backup/taxi.sql"

echo "Baza odtworzona."