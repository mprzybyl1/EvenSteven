import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { pushEnabled } from "../lib/push.js";

// Subskrypcja przychodzi z przeglądarki jako PushSubscription.toJSON().
const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function pushRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  // Klucz publiczny VAPID + info czy push w ogóle włączony na serwerze.
  app.get("/public-key", async () => ({
    enabled: pushEnabled,
    publicKey: env.VAPID_PUBLIC_KEY ?? null,
  }));

  app.post("/subscribe", async (req, reply) => {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Błędna subskrypcja" });
    const { endpoint, keys } = parsed.data;

    // Upsert po endpoint — to samo urządzenie nie tworzy duplikatów, a zmiana
    // właściciela (inny login na tym samym urządzeniu) aktualizuje przypisanie.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.authUser!.id, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId: req.authUser!.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    return { ok: true };
  });

  app.post("/unsubscribe", async (req, reply) => {
    const parsed = unsubscribeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Błędne dane" });
    await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: req.authUser!.id } });
    return { ok: true };
  });
}
