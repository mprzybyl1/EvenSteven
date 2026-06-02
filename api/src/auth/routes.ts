import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "./password.js";

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  displayName: z.string().min(1).max(60),
  password: z.string().min(8, "Hasło min. 8 znaków").max(200),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

function publicUser(u: { id: string; email: string; displayName: string }) {
  return { id: u.id, email: u.email, displayName: u.displayName };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Błędne dane", details: z.treeifyError(parsed.error) });
    }
    const { email, displayName, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "Konto z tym e-mailem już istnieje" });
    }

    const user = await prisma.user.create({
      data: { email, displayName, passwordHash: await hashPassword(password) },
    });

    const token = await reply.jwtSign({ id: user.id, email: user.email });
    reply.setAuthCookie(token);
    return reply.code(201).send({ user: publicUser(user) });
  });

  app.post("/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Błędne dane" });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    // Ten sam komunikat dla "nie ma usera" i "złe hasło" — nie zdradzamy
    // które e-maile są zarejestrowane.
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      return reply.code(401).send({ error: "Błędny e-mail lub hasło" });
    }

    const token = await reply.jwtSign({ id: user.id, email: user.email });
    reply.setAuthCookie(token);
    return reply.send({ user: publicUser(user) });
  });

  app.post("/logout", async (_req, reply) => {
    reply.clearAuthCookie();
    return reply.send({ ok: true });
  });

  app.get("/me", { preHandler: app.requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!user) return reply.code(401).send({ error: "Nie znaleziono konta" });
    return reply.send({ user: publicUser(user) });
  });
}
