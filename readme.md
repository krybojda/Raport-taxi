# Taxi

Prosty system zarządzania pracą kierowcy taxi.

## Zawartość katalogu

- `.env` - dane środowiskowe MySQL
- `docker-compose.yml` - definicje usług: aplikacja, baza MySQL, backup
- `Dockerfile` - budowanie kontenera aplikacji
- `src/` - kod backendu Node.js (Express + MySQL)
- `public/` - pliki statyczne serwowane przez backend
- `frontend/` - miejsce na frontend aplikacji (aktualnie puste)
- `uploads/` - miejsce na pliki przesyłane przez użytkowników
- `backups/` - katalog docelowy kopii backupów
- `.git/` i `.gitignore` - repozytorium Git

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

- `MYSQL_ROOT_PASSWORD`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`

## Backup

Usługa `taxi-backup` tworzy kopie zapasowe przy użyciu obrazu `offen/docker-volume-backup`.
Kopie są zapisywane w katalogu `backups`.
Backup obejmuje:

- wolumen MySQL `taxi_mysql_data`
- katalog `uploads`
- katalog `src`
- katalog `public`
- pliki `docker-compose.yml` i `Dockerfile`

## Uruchomienie

1. Upewnij się, że masz zainstalowany Docker i Docker Compose.
2. Skopiuj `.env` z odpowiednimi danymi środowiskowymi, jeśli chcesz zmienić hasła lub nazwę bazy.
3. W katalogu projektu uruchom:

```powershell
docker compose up -d --build
```

4. Sprawdź logi usługi:

```powershell
docker compose logs -f taxi-app
```

5. Aplikacja powinna być dostępna na `http://localhost:3000`.

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

## Uwagi

- `public/` zawiera proste pliki HTML (`index.html`, `test.html`) dostępne jako statyczne zasoby.
- Kod backendu zakłada, że usługa MySQL jest osiągalna przez zmienne środowiskowe z `docker-compose`.
