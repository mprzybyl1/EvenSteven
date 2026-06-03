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
- [x] **UI polish** — toasty, dialogi, daty + grupowanie, czytelne salda, animacje
- [x] **Powiadomienia push** (Web Push/VAPID) — nowy wydatek, edycja, usunięcie, spłata, dołączenie
- [x] **Dark mode** + emotka na wyjazd
- [x] **Zewnętrzne API** — osobiste tokeny (Bearer) dla integracji/botów
- [x] **Konta-widma** — dorzucasz kogoś po imieniu, zanim założy konto (z przejęciem konta)
- [x] **Zaproszenia mailem** (Gmail SMTP, opcjonalne)
- [ ] Itemized splits, auto-kursy walut, eksport CSV

## Zewnętrzne API (tokeny) — dla botów i automatyzacji

Chcesz, żeby skrypt / agent AI dopisywał wydatki sam (np. z czatu)? Wygeneruj
**osobisty token API** w aplikacji: **Profil → Tokeny API → Wygeneruj**. Token
widzisz **raz** — skopiuj go od razu. Działa "jako Ty" (pełny dostęp do Twoich
grup), dlatego trzymaj go w sekrecie i odwołaj, gdy przecieknie.

Token wysyłasz w nagłówku `Authorization: Bearer es_pat_…`. Wszystkie endpointy
aplikacji są dostępne tak samo jak z przeglądarki. Najważniejsze do automatyzacji:

```bash
BASE=https://twoja-domena      # albo http://localhost:3001 w dev
TOKEN=es_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 1) Twoje grupy (żeby znać groupId)
curl -s "$BASE/api/groups" -H "Authorization: Bearer $TOKEN"

# 2) Ekipa grupy (mapowanie imię -> userId; widać też konta-widma)
curl -s "$BASE/api/groups/<groupId>" -H "Authorization: Bearer $TOKEN"

# 3) Dopisz wydatek: kort 60 zł, wyłożył Kazik, podział równo na 4 graczy
curl -s -X POST "$BASE/api/groups/<groupId>/expenses" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "description": "Kort squash 12.06",
    "amountMinor": 6000,
    "currency": "PLN",
    "category": "sport",
    "payers": [{ "userId": "<kazik>", "amountMinor": 6000 }],
    "shares": [
      { "userId": "<kazik>",  "amountMinor": 1500 },
      { "userId": "<adam>",   "amountMinor": 1500 },
      { "userId": "<bartek>", "amountMinor": 1500 },
      { "userId": "<celina>", "amountMinor": 1500 }
    ]
  }'

# 4) Aktualne salda (kto komu ile jest jeszcze winien)
curl -s "$BASE/api/groups/<groupId>/balances" -H "Authorization: Bearer $TOKEN"
```

> 💡 **Kwoty w groszach** (`amountMinor`): 60 zł = `6000`. Zasada spójności trzyma:
> `suma(payers) == suma(shares) == amountMinor`.

**Brakuje kogoś, kto nie ma konta?** Dodaj go po imieniu (**Ekipa → Dodaj osobę**)
albo przez API (`POST /api/groups/<id>/members` z `{ "name": "Adam" }`). Powstaje
**konto-widmo** — można go normalnie wpisywać do podziału. Gdy poda e-mail (albo
użyjesz „Zaproś mailem"), dostanie link do założenia konta na **tej samej** historii
długów. Bez konfiguracji Gmaila zaproszenie i tak da się rozesłać skopiowanym linkiem.

## Wdrożenie na VPS (Docker + Caddy + Postgres)

Wszystko jedzie w kontenerach — na serwerze potrzebujesz tylko Dockera. Provider
Prismy (sqlite→postgres) i build frontu dzieją się automatycznie w obrazach.

**1. DNS** — w panelu domeny ustaw rekord `A` na publiczny IPv4 serwera
(opcjonalnie `AAAA` na IPv6). Zostaw publiczny IPv4 włączony — kumple na sieciach
mobilnych bez IPv6 inaczej się nie połączą.

**2. Serwer** — zainstaluj Dockera (Ubuntu/Debian):
```bash
curl -fsSL https://get.docker.com | sh
```

**3. Kod + sekrety:**
```bash
git clone https://github.com/mprzybyl1/EvenSteven.git
cd EvenSteven
cp .env.prod.example .env.prod
# wpisz domenę i wygeneruj sekrety:
#   openssl rand -hex 32   (dla JWT_SECRET, COOKIE_SECRET, hasła do Postgresa)
# klucze VAPID do powiadomień push (opcjonalne — bez nich push jest wyłączony):
#   docker run --rm node:22-alpine npx -y web-push generate-vapid-keys
nano .env.prod
```

**4. Start:**
```bash
docker compose --env-file .env.prod up -d --build
```

Caddy automatycznie wyrobi certyfikat HTTPS (Let's Encrypt) dla Twojej domeny.
Wejdź na `https://twoja-domena` — apka działa.

**Aktualizacja po zmianach:**
```bash
git pull && docker compose --env-file .env.prod up -d --build
```

**Podgląd logów:** `docker compose logs -f api`
