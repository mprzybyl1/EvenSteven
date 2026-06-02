import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { env, isProd } from "../env.js";

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

  // Strażnik chronionych tras.
  app.decorate("requireAuth", async (req: FastifyRequest, reply: FastifyReply) => {
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
