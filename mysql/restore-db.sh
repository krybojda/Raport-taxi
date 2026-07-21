#!/bin/bash

set -e 

set -a
source .env
set +a

echo "Odszyfrowanie bazy..."

gpg --batch \
--yes \
--passphrase "$BACKUP_MYSQL" \
-d \
-o mysql/backup/taxi.sql \
mysql/backup/taxi.sql.gpg


echo "Import..."

docker exec -i taxi-mysql \
mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
< mysql/backup/taxi.sql


rm mysql/backup/taxi.sql

echo "Baza odtworzona."