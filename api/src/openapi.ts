// Ręcznie utrzymywana specyfikacja OpenAPI 3.0 dla EvenSteven API.
//
// Świadoma decyzja: trasy walidują dane przez Zod w handlerach (safeParse), a nie
// przez schematy Fastify. Zamiast przepinać całą (działającą na prodzie) walidację
// na type-providera, trzymamy dokumentację jako osobny dokument i serwujemy ją
// pluginem @fastify/swagger w trybie `static` + Swagger UI pod /api/docs.
//
// UWAGA: przy dodawaniu/zmianie tras dopisz je tutaj — to jedyne miejsce prawdy dla
// dokumentacji (nie generuje się automatycznie z kodu).

const bearerNote =
  "Wszystkie chronione endpointy przyjmują albo cookie sesji (es_token, ustawiane po /login), " +
  "albo osobisty token API w nagłówku `Authorization: Bearer es_pat_…` (Profil → Tokeny API). " +
  "Token działa jak Ty — pełny dostęp do Twoich grup.";

const err = (desc: string) => ({
  description: desc,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const json = (ref: string) => ({ "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } });

export const openapiDocument = {
  openapi: "3.0.3",
  info: {
    title: "EvenSteven API",
    version: "1.0.0",
    description:
      "Dzielenie kosztów wyjazdów. Kwoty zawsze w **groszach** (`amountMinor`, Int) — 60 zł = 6000.\n\n" +
      bearerNote,
  },
  servers: [{ url: "/", description: "Ten serwer" }],
  tags: [
    { name: "Auth", description: "Rejestracja, logowanie, konto, przejęcie konta-widma" },
    { name: "Grupy", description: "Wyjazdy / wspólne rozliczenia i ich uczestnicy" },
    { name: "Wydatki", description: "Wydatki, spłaty i salda w grupie" },
    { name: "Tokeny", description: "Osobiste tokeny API (integracje, boty)" },
    { name: "Push", description: "Powiadomienia Web Push" },
    { name: "System", description: "Health check" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "es_pat_…", description: "Osobisty token API" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "es_token", description: "Cookie sesji (po /login)" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string", example: "Nie jesteś zalogowany" }, details: { type: "object", nullable: true } },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "cmpwingjc000094hwi3bos7cy" },
          email: { type: "string", nullable: true, example: "kazik@example.com" },
          displayName: { type: "string", example: "Kazik" },
        },
      },
      Member: {
        type: "object",
        properties: {
          userId: { type: "string" },
          displayName: { type: "string" },
          email: { type: "string", nullable: true },
          role: { type: "string", enum: ["owner", "member"] },
          joinedAt: { type: "string", format: "date-time" },
          isPlaceholder: { type: "boolean", description: "true = konto-widmo (niezarejestrowany)" },
          claimUrl: { type: "string", nullable: true, description: "Link do przejęcia konta (tylko dla widm)" },
        },
      },
      GroupListItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", example: "Squash wtorki" },
          emoji: { type: "string", nullable: true, example: "🎾" },
          description: { type: "string", nullable: true },
          baseCurrency: { type: "string", example: "PLN" },
          memberCount: { type: "integer" },
          expenseCount: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      GroupDetail: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          emoji: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          baseCurrency: { type: "string" },
          inviteCode: { type: "string", description: "Kod do linku zaproszenia" },
          createdById: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          members: { type: "array", items: { $ref: "#/components/schemas/Member" } },
        },
      },
      ExpenseLine: {
        type: "object",
        required: ["userId", "amountMinor"],
        properties: {
          userId: { type: "string" },
          amountMinor: { type: "integer", description: "Grosze. Suma payers == suma shares == amountMinor", example: 1500 },
        },
      },
      ExpenseInput: {
        type: "object",
        required: ["description", "amountMinor", "currency", "payers", "shares"],
        properties: {
          description: { type: "string", maxLength: 120, example: "Kort squash 12.06" },
          amountMinor: { type: "integer", minimum: 1, example: 6000 },
          currency: { type: "string", example: "PLN", description: "Kod ISO 4217 (3 litery)" },
          rateToBase: { type: "number", default: 1, description: "Kurs do waluty bazowej grupy" },
          splitMethod: { type: "string", enum: ["equal", "exact", "percent", "shares"], default: "equal" },
          category: { type: "string", nullable: true, example: "sport" },
          date: { type: "string", format: "date-time", nullable: true },
          payers: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/ExpenseLine" }, description: "Kto wyłożył i ile" },
          shares: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/ExpenseLine" }, description: "Kto jest winien i ile" },
        },
      },
      Balance: {
        type: "object",
        properties: {
          userId: { type: "string" },
          displayName: { type: "string" },
          amountMinor: { type: "integer", description: "Dodatnie = ma dostać, ujemne = winien (w walucie bazowej)" },
        },
      },
      Transaction: {
        type: "object",
        properties: {
          fromUserId: { type: "string" },
          fromName: { type: "string" },
          toUserId: { type: "string" },
          toName: { type: "string" },
          amountMinor: { type: "integer" },
        },
      },
      ApiToken: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", example: "Agent squash" },
          prefix: { type: "string", example: "es_pat_kWNXgCD" },
          lastUsedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  // Domyślnie wszystko chronione; publiczne trasy nadpisują `security: []`.
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  paths: {
    "/api/health": {
      get: { tags: ["System"], summary: "Health check", security: [], responses: { 200: { description: "OK" } } },
    },

    "/api/auth/register": {
      post: {
        tags: ["Auth"], summary: "Rejestracja", security: [],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "displayName", "password"], properties: { email: { type: "string", format: "email" }, displayName: { type: "string" }, password: { type: "string", minLength: 8 } } } } } },
        responses: { 201: { description: "Utworzono + ustawiono cookie", content: json("User") }, 409: err("E-mail zajęty") },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"], summary: "Logowanie", security: [],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } } } } },
        responses: { 200: { description: "Zalogowano + cookie", content: json("User") }, 401: err("Błędny e-mail lub hasło") },
      },
    },
    "/api/auth/logout": {
      post: { tags: ["Auth"], summary: "Wylogowanie", security: [], responses: { 200: { description: "OK" } } },
    },
    "/api/auth/me": {
      get: { tags: ["Auth"], summary: "Dane zalogowanego", responses: { 200: { description: "OK", content: json("User") }, 401: err("Niezalogowany") } },
      patch: {
        tags: ["Auth"], summary: "Zmiana ksywki",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["displayName"], properties: { displayName: { type: "string" } } } } } },
        responses: { 200: { description: "OK", content: json("User") } },
      },
    },
    "/api/auth/change-password": {
      post: {
        tags: ["Auth"], summary: "Zmiana hasła",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["currentPassword", "newPassword"], properties: { currentPassword: { type: "string" }, newPassword: { type: "string", minLength: 8 } } } } } },
        responses: { 200: { description: "OK" }, 400: err("Aktualne hasło błędne") },
      },
    },
    "/api/auth/claim/{token}": {
      get: {
        tags: ["Auth"], summary: "Podgląd zaproszenia konta-widma", security: [],
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Kogo i do jakich grup dotyczy" }, 404: err("Link nieaktualny") },
      },
    },
    "/api/auth/claim": {
      post: {
        tags: ["Auth"], summary: "Przejęcie konta-widma (rejestracja na tej samej linijce)", security: [],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["token", "email", "displayName", "password"], properties: { token: { type: "string" }, email: { type: "string", format: "email" }, displayName: { type: "string" }, password: { type: "string", minLength: 8 } } } } } },
        responses: { 201: { description: "Konto aktywowane + cookie", content: json("User") }, 409: err("E-mail zajęty") },
      },
    },

    "/api/groups": {
      get: { tags: ["Grupy"], summary: "Moje grupy", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { groups: { type: "array", items: { $ref: "#/components/schemas/GroupListItem" } } } } } } } } },
      post: {
        tags: ["Grupy"], summary: "Utwórz grupę",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "baseCurrency"], properties: { name: { type: "string" }, emoji: { type: "string", nullable: true }, description: { type: "string" }, baseCurrency: { type: "string", example: "PLN" } } } } } },
        responses: { 201: { description: "Utworzono" } },
      },
    },
    "/api/groups/invite/{code}": {
      get: { tags: ["Grupy"], summary: "Podgląd zaproszenia linkiem", parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" }, 404: err("Brak zaproszenia") } },
    },
    "/api/groups/join": {
      post: {
        tags: ["Grupy"], summary: "Dołącz kodem zaproszenia",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["inviteCode"], properties: { inviteCode: { type: "string" } } } } } },
        responses: { 201: { description: "Dołączono" }, 404: err("Brak zaproszenia") },
      },
    },
    "/api/groups/{id}": {
      get: { tags: ["Grupy"], summary: "Szczegóły grupy + ekipa", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { group: { $ref: "#/components/schemas/GroupDetail" } } } } } }, 403: err("Nie należysz do grupy") } },
      patch: { tags: ["Grupy"], summary: "Edytuj grupę", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "baseCurrency"], properties: { name: { type: "string" }, emoji: { type: "string", nullable: true }, description: { type: "string", nullable: true }, baseCurrency: { type: "string" } } } } } }, responses: { 200: { description: "OK" } } },
      delete: { tags: ["Grupy"], summary: "Usuń grupę (owner)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" }, 403: err("Tylko właściciel") } },
    },
    "/api/groups/{id}/leave": {
      post: { tags: ["Grupy"], summary: "Opuść grupę", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" }, 400: err("Masz wydatki / jesteś właścicielem") } },
    },
    "/api/groups/{id}/members": {
      post: {
        tags: ["Grupy"], summary: "Dodaj osobę (po imieniu = konto-widmo) albo istniejącego po e-mailu",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, email: { type: "string", format: "email", nullable: true } } } } } },
        responses: { 201: { description: "Dodano", content: { "application/json": { schema: { type: "object", properties: { member: { $ref: "#/components/schemas/Member" }, invited: { type: "boolean" } } } } } } },
      },
    },
    "/api/groups/{id}/members/{userId}/invite": {
      post: {
        tags: ["Grupy"], summary: "Wyślij zaproszenie mailem do konta-widma",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "userId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } } } },
        responses: { 200: { description: "Wysłano (lub zwraca claimUrl gdy mail wyłączony)" } },
      },
    },
    "/api/groups/{id}/members/{userId}": {
      delete: { tags: ["Grupy"], summary: "Wyrzuć członka (owner)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "userId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" }, 400: err("Ma wydatki/spłaty") } },
    },

    "/api/groups/{groupId}/expenses": {
      get: { tags: ["Wydatki"], summary: "Lista wydatków", parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" } } },
      post: {
        tags: ["Wydatki"], summary: "Dodaj wydatek",
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: json("ExpenseInput") },
        responses: { 201: { description: "Utworzono" }, 400: err("Suma payers/shares != kwocie albo nie-członek") },
      },
    },
    "/api/groups/{groupId}/expenses/{expenseId}": {
      get: { tags: ["Wydatki"], summary: "Szczegóły wydatku", parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }, { name: "expenseId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" } } },
      put: { tags: ["Wydatki"], summary: "Edytuj wydatek", parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }, { name: "expenseId", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: json("ExpenseInput") }, responses: { 200: { description: "OK" } } },
      delete: { tags: ["Wydatki"], summary: "Usuń wydatek", parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }, { name: "expenseId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" } } },
    },
    "/api/groups/{groupId}/settlements": {
      get: { tags: ["Wydatki"], summary: "Lista spłat", parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" } } },
      post: {
        tags: ["Wydatki"], summary: "Dodaj spłatę (A oddał B)",
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["fromUserId", "toUserId", "amountMinor"], properties: { fromUserId: { type: "string" }, toUserId: { type: "string" }, amountMinor: { type: "integer" }, note: { type: "string", nullable: true } } } } } },
        responses: { 201: { description: "OK" } },
      },
    },
    "/api/groups/{groupId}/settlements/{settlementId}": {
      delete: { tags: ["Wydatki"], summary: "Usuń spłatę", parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }, { name: "settlementId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" } } },
    },
    "/api/groups/{groupId}/balances": {
      get: {
        tags: ["Wydatki"], summary: "Salda + minimalne przelewy (kto komu ile)",
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { baseCurrency: { type: "string" }, balances: { type: "array", items: { $ref: "#/components/schemas/Balance" } }, transactions: { type: "array", items: { $ref: "#/components/schemas/Transaction" } } } } } } } },
      },
    },

    "/api/tokens": {
      get: { tags: ["Tokeny"], summary: "Lista moich tokenów (bez plaintextu)", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { tokens: { type: "array", items: { $ref: "#/components/schemas/ApiToken" } } } } } } } } },
      post: {
        tags: ["Tokeny"], summary: "Utwórz token (plaintext zwrócony RAZ)",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string", example: "Agent squash" } } } } } },
        responses: { 201: { description: "Utworzono", content: { "application/json": { schema: { type: "object", properties: { token: { type: "string", description: "Pełny token — widoczny tylko teraz!" }, info: { $ref: "#/components/schemas/ApiToken" } } } } } } },
      },
    },
    "/api/tokens/{id}": {
      delete: { tags: ["Tokeny"], summary: "Odwołaj token", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK" }, 404: err("Brak tokenu") } },
    },

    "/api/push/public-key": {
      get: { tags: ["Push"], summary: "Klucz publiczny VAPID", security: [], responses: { 200: { description: "OK" } } },
    },
    "/api/push/subscribe": {
      post: { tags: ["Push"], summary: "Zapisz subskrypcję push", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "OK" } } },
    },
    "/api/push/unsubscribe": {
      post: { tags: ["Push"], summary: "Usuń subskrypcję push", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { endpoint: { type: "string" } } } } } }, responses: { 200: { description: "OK" } } },
    },
  },
} as const;
