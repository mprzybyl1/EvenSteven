import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env, isProd } from "./env.js";
import { authPlugin } from "./auth/plugin.js";
import { authRoutes } from "./auth/routes.js";
import { prisma } from "./db.js";

const app = Fastify({
  logger: isProd
    ? true
    : { transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } } },
});

// --- Bezpieczeństwo ---
await app.register(helmet, { contentSecurityPolicy: false }); // CSP ustawimy gdy front gotowy
await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true }); // credentials -> cookie przechodzi
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

// --- Auth (cookie + jwt + strażnik) ---
await app.register(authPlugin);

// --- Trasy ---
app.get("/api/health", async () => ({ ok: true, service: "evensteven-api" }));
await app.register(authRoutes, { prefix: "/api/auth" });

// Logowanie/rejestracja ostrzej rate-limitowane (anty brute-force) — globalny limit
// już jest, tu zostawiamy miejsce na ewentualny ostrzejszy per-route limit później.

const stop = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
