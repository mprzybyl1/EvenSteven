import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { PAT_PREFIX, hashToken } from "../auth/plugin.js";

const createSchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę").max(60),
});

// es_pat_ + 32 losowe bajty (base64url) = ~43 znaki entropii. Nie do zgadnięcia.
function generateToken() {
  return PAT_PREFIX + randomBytes(32).toString("base64url");
}

export async function tokenRoutes(app: FastifyInstance) {
  // Zarządzanie tokenami wymaga zalogowania (z aplikacji — cookie albo inny token).
  app.addHook("preHandler", app.requireAuth);

  // Lista moich tokenów (bez plaintextu — pokazujemy tylko prefiks i metadane).
  app.get("/", async (req) => {
    const tokens = await prisma.apiToken.findMany({
      where: { userId: req.authUser!.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
    });
    return { tokens };
  });

  // Utwórz token — plaintext zwracamy TYLKO TERAZ, nigdzie go nie zapisujemy.
  app.post("/", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Podaj nazwę tokenu" });

    const token = generateToken();
    const created = await prisma.apiToken.create({
      data: {
        userId: req.authUser!.id,
        name: parsed.data.name,
        tokenHash: hashToken(token),
        prefix: token.slice(0, 14), // np. "es_pat_AbCd12"
      },
      select: { id: true, name: true, prefix: true, createdAt: true },
    });
    // `token` widzisz raz — skopiuj i wklej do swojej integracji.
    return reply.code(201).send({ token, info: created });
  });

  // Odwołaj token (skasuj). Od tej chwili przestaje działać.
  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const t = await prisma.apiToken.findUnique({ where: { id } });
    if (!t || t.userId !== req.authUser!.id) {
      return reply.code(404).send({ error: "Nie ma takiego tokenu" });
    }
    await prisma.apiToken.delete({ where: { id } });
    return { ok: true };
  });
}
