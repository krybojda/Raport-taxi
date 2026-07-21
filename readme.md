# Taxi

Prosty system zarządzania pracą kierowcy taxi.

## Zawartość katalogu

- `.env` - dane środowiskowe MySQL (lokalny plik konfiguracyjny)
- `.env.example` - przykład ustawień środowiskowych
- `docker-compose.yml` - definicje usług: aplikacja, baza MySQL, backup
- `Dockerfile` - budowanie kontenera aplikacji
- `eslint.config.mjs` - konfiguracja ESLint
- `.prettierrc` - konfiguracja Prettier
- `.githooks/` - skrypty hooków Git (`pre-commit`, `post-merge`)
- `.github/` - definicje GitHub Actions i inne ustawienia CI
- `mysql/` - skrypty backup/restore MySQL
- `src/` - kod backendu Node.js (Express + MySQL)
- `public/` - pliki statyczne serwowane przez backend
- `uploads/` - miejsce na pliki przesyłane przez użytkowników
- `backups/` - katalog docelowy kopii backupów
- `package.json` i `package-lock.json` - zależności Node.js i skrypty npm
- `.gitignore` - pliki ignorowane przez Git

## Backend

Aplikacja działa na Node.js i używa:

- `express`
- `mysql2`
- `dotenv`
- `cors`

Plik wejściowy to `src/server.js`.
Serwer nasłuchuje na porcie `3000` i serwuje zawartość katalogu `public`.

Dostępne endpointy:

- `GET /api/test-db` - sprawdza połączenie z bazą MySQL

## Baza danych

`docker-compose.yml` uruchamia usługę `taxi-mysql` z obrazem `mysql:8.4`.
Dane połączenia pobierane są z `.env`:

- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`

## Backup i restore bazy danych

W projekcie są dwa skrypty w katalogu `mysql/`:

- `mysql/backup-db.sh` — tworzy zrzut bazy danych i szyfruje go do `mysql/backup/taxi.sql.gpg`
- `mysql/restore-db.sh` — odszyfrowuje `mysql/backup/taxi.sql.gpg` i importuje dane z powrotem do MySQL

Jak to działa:

1. `backup-db.sh` uruchamia `mysqldump` wewnątrz kontenera `taxi-mysql` i zapisuje wynik do tymczasowego pliku `mysql/backup/taxi.sql`.
2. Następnie plik jest szyfrowany poleceniem `gpg -c` z hasłem z zmiennej `BACKUP_MYSQL`.
3. Po zaszyfrowaniu plik `taxi.sql` jest usuwany, więc w repozytorium pozostaje tylko `taxi.sql.gpg`.

Przywracanie:

1. `restore-db.sh` odszyfrowuje `mysql/backup/taxi.sql.gpg` na `mysql/backup/taxi.sql`.
2. Potem importuje ten plik do kontenera `taxi-mysql` przy pomocy polecenia `mysql`.
3. Po zakończeniu plik `taxi.sql` jest usuwany.

Wymagane zmienne w `.env`:

- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `BACKUP_MYSQL` — hasło do szyfrowania/odszyfrowania backupu

Uwaga:

- `gpg` musi być zainstalowany na maszynie, z której uruchamiasz skrypty.
- Upewnij się, że katalog `mysql/backup` istnieje, zanim uruchomisz `mysql/backup-db.sh` lub `mysql/restore-db.sh`.
- `mysql/backup/taxi.sql` jest tylko plikiem tymczasowym i jest usuwany po operacji.
- W repozytorium powinien być widoczny tylko zaszyfrowany plik `mysql/backup/taxi.sql.gpg`, a nie jawny zrzut SQL z rekordami bazy.

## Automatyczny backup i restore

W repozytorium zdefiniowane są hooki Git, które wykonują:

- `pre-commit` — przed commitem uruchamiany jest `./mysql/backup-db.sh`, aby zaszyfrować aktualny zrzut bazy
- `post-merge` — po `git pull` uruchamiany jest `./mysql/restore-db.sh`, aby przywrócić bazę z zaszyfrowanego backupu

Dzięki temu w repozytorium nie trafiają jawne dane z bazy, tylko zaszyfrowany backup, a lokalna baza jest synchronizowana po pobraniu zmian.

Uwaga: restore może nadpisać dane lokalne, które nie zostały zbackupowane przez ostatni commit i znajdują się tylko w lokalnej bazie.

## Backup

Usługa `taxi-backup` tworzy kopie zapasowe przy użyciu obrazu `offen/docker-volume-backup`.
Kopie są zapisywane w katalogu `backups`.
Backup obejmuje:

- wolumen MySQL `taxi_mysql_data`
- katalog `uploads`
- katalog `src`
- katalog `public`
- pliki `docker-compose.yml` i `Dockerfile`

## Uruchomienie i po sklonowaniu repozytorium

1. `git clone <repozytorium>`
2. `cd Raport-taxi`
3. `cp .env.example .env`
4. Uzupełnij `.env` o dane połączenia do MySQL i wartość `BACKUP_MYSQL`.
5. Jeśli jeszcze nie masz zainstalowanych zależności Node.js, uruchom `npm install`.
6. Skonfiguruj hooki Git i uprawnienia:

```powershell
git config core.hooksPath .githooks
chmod +x .githooks/*
chmod +x mysql/*.sh
```

7. Uruchom Docker Compose:

```powershell
docker compose up -d --build
```

8. Aplikacja powinna być dostępna na `http://localhost:3000`.


## Skrypty npm

Dostępne skrypty w `package.json`:

- `npm start` - uruchamia `node src/server.js`
- `npm run dev` - uruchamia `node --watch src/server.js`
- `npm run lint` - uruchamia ESLint w celu sprawdzenia jakości kodu
- `npm run lint:fix` - automatycznie poprawia problemy wykryte przez ESLint
- `npm run format` - sprawdza formatowanie kodu przy użyciu Prettier
- `npm run format:fix` - automatycznie formatuje pliki zgodnie z zasadami Prettier

## Dostępność

Strona jest dostępna pod adresem:
- https://krybojda.ddns.net/taxi/
