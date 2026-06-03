import "dotenv/config"; // wczytaj .env zanim cokolwiek przeczyta process.env
import { z } from "zod";

// Walidujemy zmienne środowiskowe na starcie — jak czegoś brakuje, apka
// nie wstaje (lepiej crash od razu niż dziwne błędy w runtime).
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET musi mieć min. 16 znaków"),
  COOKIE_SECRET: z.string().min(16, "COOKIE_SECRET musi mieć min. 16 znaków"),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Web Push — opcjonalne. Bez kompletu kluczy push jest wyłączony.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:admin@example.com"),
  // Wysyłka maili przez Gmail SMTP (app-password). Bez kompletu — mail wyłączony.
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  // Publiczny origin aplikacji webowej — do budowania linków w mailach (claim/zaproszenia).
  // Na prodzie ustaw na adres strony, np. https://evensteven.twojadomena.pl
  APP_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Błędna konfiguracja środowiska:");
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
