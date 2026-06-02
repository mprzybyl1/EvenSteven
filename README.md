# EvenSteven 🏔️

Własny "Splitwise" do dzielenia kosztów wyjazdu z ekipą. Bo płacić za subskrypcję się nie chce, a zrobić samemu to fun.

**Mobile-first PWA** (działa też na kompie), bezpieczne konta, multi-waluta, i model, który ogarnia *każdy* rodzaj wymiany kasy — od wspólnej pizzy po "wiszę ci tylko za bilet".

## Stack

| Warstwa   | Technologia |
|-----------|-------------|
| Frontend  | React + Vite + TypeScript, Tailwind v4, PWA (vite-plugin-pwa) |
| Backend   | Fastify + TypeScript, Zod (walidacja), argon2 (hasła), JWT w httpOnly cookie |
| Baza      | Prisma ORM — **SQLite** w dev, **PostgreSQL** na prod |
| Deploy    | Docker Compose + Caddy (auto-HTTPS) na VPS |

> 💡 Kwoty trzymamy w **groszach jako liczby całkowite** (`amountMinor`), nigdy jako float — żeby salda zawsze się spinały co do grosza.

## Struktura

```
evensteven/
├── api/                 # backend Fastify + Prisma
│   ├── prisma/
│   │   ├── schema.prisma # model danych
│   │   └── seed.ts       # dane demo (grupa "Bieszczady 2026")
│   └── src/
│       ├── server.ts     # wejście, rejestracja pluginów
│       ├── env.ts        # walidacja zmiennych środowiskowych
│       ├── db.ts         # klient Prisma
│       └── auth/         # hasła, plugin JWT, trasy logowania
├── web/                 # frontend React PWA
│   └── src/
│       ├── auth/         # AuthProvider (stan zalogowania)
│       ├── pages/        # Login, Register, Dashboard
│       ├── components/   # Logo itd.
│       └── lib/api.ts    # wrapper na fetch
├── docker-compose.yml   # wdrożenie prod (szkielet)
├── Caddyfile            # reverse proxy + HTTPS
└── assets/logo.png
```

## Odpalanie lokalnie (dev)

Potrzebujesz **dwóch terminali** — backend i frontend.

**1. Backend:**
```powershell
cd api
npm install
copy .env.example .env       # i ew. zmień sekrety
npx prisma migrate dev       # tworzy bazę SQLite + dane demo
npm run dev                  # API na http://localhost:3001
```

**2. Frontend:**
```powershell
cd web
npm install
npm run dev                  # PWA na http://localhost:5173
```

Wejdź na **http://localhost:5173**. Vite proxuje `/api` na backend, więc cookie sesji działa bez CORS-owych przygód.

**Konto demo:** `kazik@example.com` / `haslo123`

## Model domenowy — jak jeden mechanizm ogarnia wszystko

Każdy **wydatek** (`Expense`) ma dwie listy:
- **`payers`** — kto wyłożył kasę i ile,
- **`shares`** — kto i ile jest winien za ten wydatek.

To pokrywa wszystkie przypadki bez specjalnego kodu:

| Scenariusz | Model |
|---|---|
| Pizza 50 zł na 5 równo | payer: ja 50; shares: 5×10 |
| Dzielone nierówno | shares: dowolne kwoty/% |
| Wiszę ci za bilet (dług 1:1) | payer: ty 50; **jedyny** share: ja 50 |
| Taxi tylko dla 3 z 6 | shares: tylko te 3 osoby |
| Dwóch płaciło jedno zamówienie | payers: ty 100 + ja 50 |
| Oddałem ci 80 zł | osobny `Settlement` (nie wydatek) |

Zasada spójności: `suma(payers) == suma(shares) == amountMinor`.

**Multi-waluta:** każdy wydatek ma `currency` + `rateToBase` (kurs do waluty bazowej grupy). Salda liczymy w walucie bazowej grupy.

## Roadmapa

- [x] **Fundament:** repo, schema, auth (rejestracja/login/cookie), szkielet PWA, branding
- [x] **Grupy:** twórz wyjazd, zapraszaj ludzi (link), lista członków
- [x] **Wydatki:** dodawanie z podziałem (równo/kwoty/procenty), inna waluta z kursem
- [x] **Spłaty** + ekran "kto komu ile" (zachłanne wyrównanie)
- [x] **Multi-waluta** w UI (kurs ręczny per wydatek)
- [x] **Multi-płatnik** w UI (tryb Jeden / Kilku płatników)
- [x] **Edycja wydatku** (klik w wydatek na liście)
- [x] **Uproszczenie długów** — minimalna liczba przelewów (backtracking + fallback)
- [x] **Ręczne spłaty** + usuwanie spłat
- [x] **Zarządzanie grupą** — edycja, usuwanie, opuszczanie, wyrzucanie członka
- [x] **Kategorie wydatków** (z ikonami + podsumowanie wg kategorii)
- [x] **Konto** — profil, zmiana ksywki i hasła
- [ ] UI polish (drobne poprawki wyglądu/UX)
- [ ] Itemized splits, auto-kursy walut, eksport CSV
- [ ] Wdrożenie na VPS (Docker + Caddy + Postgres)

## Wdrożenie (skrót — później)

1. `web`: `npm run build` → statyk do `web/dist`
2. `api/prisma/schema.prisma`: provider na `postgresql`
3. `.env.prod.example` → `.env.prod`, uzupełnij sekrety + domenę
4. `docker compose --env-file .env.prod up -d --build`

Caddy sam ogarnie certyfikat HTTPS dla domeny.
