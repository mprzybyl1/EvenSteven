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

const updateMeSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  avatarEmoji: z.string().trim().max(16).nullable().optional(),
  blikPhone: z.string().trim().max(32).nullable().optional(),
  bankAccount: z.string().trim().max(64).nullable().optional(),
  payNote: z.string().trim().max(200).nullable().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Hasło min. 8 znaków").max(200),
});

const claimSchema = z.object({
  token: z.string().min(1),
  email: z.string().email().toLowerCase(),
  displayName: z.string().trim().min(1).max(60),
  password: z.string().min(8, "Hasło min. 8 znaków").max(200),
});

function publicUser(u: {
  id: string; email: string | null; displayName: string; avatarEmoji?: string | null;
  blikPhone?: string | null; bankAccount?: string | null; payNote?: string | null;
}) {
  return {
    id: u.id, email: u.email, displayName: u.displayName, avatarEmoji: u.avatarEmoji ?? null,
    blikPhone: u.blikPhone ?? null, bankAccount: u.bankAccount ?? null, payNote: u.payNote ?? null,
  };
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

    const token = await reply.jwtSign({ id: user.id, email });
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
    // Ten sam komunikat dla "nie ma usera", "konto-widmo bez hasła" i "złe hasło" —
    // nie zdradzamy które e-maile są zarejestrowane.
    if (!user || !user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      return reply.code(401).send({ error: "Błędny e-mail lub hasło" });
    }

    const token = await reply.jwtSign({ id: user.id, email });
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

  app.patch("/me", { preHandler: app.requireAuth }, async (req, reply) => {
    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Błędne dane" });

    const data: {
      displayName?: string; avatarEmoji?: string | null;
      blikPhone?: string | null; bankAccount?: string | null; payNote?: string | null;
    } = {};
    if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName;
    // avatarEmoji: pusty string albo null = wyczyść (wraca do inicjału).
    if (parsed.data.avatarEmoji !== undefined) data.avatarEmoji = parsed.data.avatarEmoji || null;
    // Dane płatnicze: pusty string = wyczyść pole.
    if (parsed.data.blikPhone !== undefined) data.blikPhone = parsed.data.blikPhone || null;
    if (parsed.data.bankAccount !== undefined) data.bankAccount = parsed.data.bankAccount || null;
    if (parsed.data.payNote !== undefined) data.payNote = parsed.data.payNote || null;

    const user = await prisma.user.update({ where: { id: req.authUser!.id }, data });
    return reply.send({ user: publicUser(user) });
  });

  app.post("/change-password", { preHandler: app.requireAuth }, async (req, reply) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Hasło min. 8 znaków" });

    const user = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!user) return reply.code(401).send({ error: "Nie znaleziono konta" });
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
      return reply.code(400).send({ error: "Aktualne hasło jest błędne" });
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });
    return reply.send({ ok: true });
  });

  // --- Przejęcie konta-widma (claim) ---
  // Ktoś dodał Cię do wyjazdu po imieniu (konto bez hasła). Z linku z claimToken
  // zakładasz prawdziwe konto NA TEJ SAMEJ linijce — cała historia Twoich długów zostaje.

  // Podgląd zaproszenia (bez logowania): kogo i do jakich wyjazdów dotyczy.
  app.get("/claim/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const ghost = await prisma.user.findUnique({
      where: { claimToken: token },
      select: {
        id: true,
        displayName: true,
        isPlaceholder: true,
        memberships: { select: { group: { select: { name: true, emoji: true } } } },
      },
    });
    if (!ghost || !ghost.isPlaceholder) {
      return reply.code(404).send({ error: "Link nieaktualny lub konto już przejęte" });
    }
    return {
      displayName: ghost.displayName,
      groups: ghost.memberships.map((m) => ({ name: m.group.name, emoji: m.group.emoji })),
    };
  });

  // Aktywacja konta-widma: ustaw e-mail + hasło, wyczyść flagę placeholder i claimToken.
  app.post("/claim", async (req, reply) => {
    const parsed = claimSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Błędne dane", details: z.treeifyError(parsed.error) });
    }
    const { token, email, displayName, password } = parsed.data;

    const ghost = await prisma.user.findUnique({ where: { claimToken: token } });
    if (!ghost || !ghost.isPlaceholder) {
      return reply.code(404).send({ error: "Link nieaktualny lub konto już przejęte" });
    }

    // E-mail nie może kolidować z innym, już istniejącym kontem.
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash && clash.id !== ghost.id) {
      return reply.code(409).send({ error: "Konto z tym e-mailem już istnieje — zaloguj się na nie" });
    }

    const user = await prisma.user.update({
      where: { id: ghost.id },
      data: {
        email,
        displayName,
        passwordHash: await hashPassword(password),
        isPlaceholder: false,
        claimToken: null,
      },
    });

    const jwtToken = await reply.jwtSign({ id: user.id, email });
    reply.setAuthCookie(jwtToken);
    return reply.code(201).send({ user: publicUser(user) });
  });
}
