import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { createHash } from "node:crypto";
import { env, isProd } from "../env.js";
import { prisma } from "../db.js";

// Prefiks osobistych tokenów API. Token = "es_pat_" + losowe bajty (base64url).
export const PAT_PREFIX = "es_pat_";
// Tokeny trzymamy w bazie tylko jako hash — szukamy po sha256(token).
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Co trzymamy w tokenie (minimalnie — resztę dociągamy z bazy gdy trzeba).
export interface AuthUser {
  id: string;
  email: string;
}

declare module "fastify" {
  interface FastifyInstance {
    // preHandler do wpięcia na chronione trasy
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

const COOKIE_NAME = "es_token";

export const authPlugin = fp(async (app: FastifyInstance) => {
  await app.register(cookie, { secret: env.COOKIE_SECRET });
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: COOKIE_NAME, signed: false },
    sign: { expiresIn: "30d" },
  });

  // Ustaw token w httpOnly cookie (front nie ma do niego dostępu z JS -> mniej XSS-ryzyka).
  app.decorateReply("setAuthCookie", function (this: FastifyReply, token: string) {
    this.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd, // przez HTTPS w prod
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  });

  app.decorateReply("clearAuthCookie", function (this: FastifyReply) {
    this.clearCookie(COOKIE_NAME, { path: "/" });
  });

  // Strażnik chronionych tras. Dwa sposoby uwierzytelnienia:
  //  1. Authorization: Bearer es_pat_...  -> osobisty token API (integracje, agent AI)
  //  2. cookie es_token (JWT)             -> normalne logowanie z aplikacji
  app.decorate("requireAuth", async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      const token = header.slice(7).trim();
      if (!token.startsWith(PAT_PREFIX)) {
        return reply.code(401).send({ error: "Nieprawidłowy token API" });
      }
      const row = await prisma.apiToken.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: { select: { id: true, email: true, isPlaceholder: true } } },
      });
      // Konto-widmo nie ma prawa działać przez token (nie powinno go mieć, ale na wszelki wypadek).
      if (!row || row.user.isPlaceholder) {
        return reply.code(401).send({ error: "Nieprawidłowy token API" });
      }
      req.authUser = { id: row.user.id, email: row.user.email ?? "" };
      // Odśwież "ostatnio użyty" — fire-and-forget, nie blokujemy odpowiedzi.
      void prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      return;
    }
    try {
      const payload = await req.jwtVerify<AuthUser>();
      req.authUser = payload;
    } catch {
      reply.code(401).send({ error: "Nie jesteś zalogowany" });
    }
  });
});

declare module "fastify" {
  interface FastifyReply {
    setAuthCookie(token: string): void;
    clearAuthCookie(): void;
  }
}
