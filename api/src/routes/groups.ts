import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { notifyGroupExcept } from "../lib/push.js";

const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Kod waluty to 3 litery, np. PLN");

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  baseCurrency: currencyCode,
});

const joinSchema = z.object({
  inviteCode: z.string().trim().min(1),
});

const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional().nullable(),
  baseCurrency: currencyCode,
});

// Pomocnik: czy user jest członkiem grupy? Zwraca membership albo null.
async function membership(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
}

// Czy user jest finansowo zaangażowany w grupie (jest w jakimś wydatku albo spłacie)?
// Jeśli tak — nie pozwalamy go usunąć/opuścić, żeby nie rozspójnić sald.
async function isFinanciallyInvolved(groupId: string, userId: string) {
  const [paid, owed, settled] = await Promise.all([
    prisma.expensePayer.count({ where: { userId, expense: { groupId } } }),
    prisma.expenseShare.count({ where: { userId, expense: { groupId } } }),
    prisma.settlement.count({ where: { groupId, OR: [{ fromUserId: userId }, { toUserId: userId }] } }),
  ]);
  return paid + owed + settled > 0;
}

export async function groupRoutes(app: FastifyInstance) {
  // Wszystkie trasy grup wymagają zalogowania.
  app.addHook("preHandler", app.requireAuth);

  // Lista moich grup (gdzie jestem członkiem) + liczba członków.
  app.get("/", async (req) => {
    const userId = req.authUser!.id;
    const groups = await prisma.group.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true, expenses: true } } },
    });
    return {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        baseCurrency: g.baseCurrency,
        memberCount: g._count.members,
        expenseCount: g._count.expenses,
        createdAt: g.createdAt,
      })),
    };
  });

  // Utwórz grupę — twórca od razu zostaje właścicielem (owner).
  app.post("/", async (req, reply) => {
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Błędne dane", details: z.treeifyError(parsed.error) });
    }
    const userId = req.authUser!.id;
    const { name, description, baseCurrency } = parsed.data;

    const group = await prisma.group.create({
      data: {
        name,
        description,
        baseCurrency,
        createdById: userId,
        members: { create: { userId, role: "owner" } },
      },
    });
    return reply.code(201).send({ group });
  });

  // Podgląd zaproszenia (nazwa grupy) zanim dołączysz — bez bycia członkiem.
  app.get("/invite/:code", async (req, reply) => {
    const { code } = req.params as { code: string };
    const group = await prisma.group.findUnique({
      where: { inviteCode: code },
      select: { id: true, name: true, baseCurrency: true, _count: { select: { members: true } } },
    });
    if (!group) return reply.code(404).send({ error: "Nie ma takiego zaproszenia" });
    return { group: { id: group.id, name: group.name, baseCurrency: group.baseCurrency, memberCount: group._count.members } };
  });

  // Dołącz do grupy przez kod zaproszenia.
  app.post("/join", async (req, reply) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Błędne dane" });
    const userId = req.authUser!.id;

    const group = await prisma.group.findUnique({ where: { inviteCode: parsed.data.inviteCode } });
    if (!group) return reply.code(404).send({ error: "Nie ma takiego zaproszenia" });

    const already = await membership(group.id, userId);
    if (already) return reply.send({ group: { id: group.id }, alreadyMember: true });

    await prisma.groupMember.create({ data: { groupId: group.id, userId, role: "member" } });

    // Powiadom dotychczasowych członków, że ktoś dołączył (fire-and-forget).
    void (async () => {
      const joiner = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
      await notifyGroupExcept(group.id, userId, {
        title: group.name,
        body: `${joiner?.displayName ?? "Ktoś"} dołączył do wyjazdu`,
        url: `/groups/${group.id}`,
      });
    })().catch(() => {});

    return reply.code(201).send({ group: { id: group.id }, alreadyMember: false });
  });

  // Szczegóły grupy + członkowie. Tylko dla członków.
  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.authUser!.id;
    if (!(await membership(id, userId))) {
      return reply.code(403).send({ error: "Nie należysz do tej grupy" });
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { joinedAt: "asc" },
          include: { user: { select: { id: true, displayName: true, email: true } } },
        },
      },
    });
    if (!group) return reply.code(404).send({ error: "Nie znaleziono grupy" });

    return {
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        baseCurrency: group.baseCurrency,
        inviteCode: group.inviteCode,
        createdById: group.createdById,
        createdAt: group.createdAt,
        members: group.members.map((m) => ({
          userId: m.userId,
          displayName: m.user.displayName,
          email: m.user.email,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    };
  });

  // Edycja grupy. Nazwę/opis może zmienić każdy członek. Walutę bazową tylko
  // gdy nie ma jeszcze wydatków (inaczej historyczne kursy przestałyby pasować).
  app.patch("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.authUser!.id;
    if (!(await membership(id, userId))) return reply.code(403).send({ error: "Nie należysz do tej grupy" });

    const parsed = updateGroupSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Błędne dane", details: z.treeifyError(parsed.error) });

    const group = await prisma.group.findUnique({ where: { id }, select: { baseCurrency: true, _count: { select: { expenses: true } } } });
    if (!group) return reply.code(404).send({ error: "Nie znaleziono grupy" });

    if (parsed.data.baseCurrency !== group.baseCurrency && group._count.expenses > 0) {
      return reply.code(400).send({ error: "Nie można zmienić waluty gdy są już wydatki" });
    }

    const updated = await prisma.group.update({
      where: { id },
      data: { name: parsed.data.name, description: parsed.data.description ?? null, baseCurrency: parsed.data.baseCurrency },
    });
    return { group: { id: updated.id, name: updated.name, description: updated.description, baseCurrency: updated.baseCurrency } };
  });

  // Usunięcie grupy — tylko właściciel. Kaskadowo kasuje wydatki/spłaty/członków.
  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const m = await membership(id, req.authUser!.id);
    if (!m) return reply.code(403).send({ error: "Nie należysz do tej grupy" });
    if (m.role !== "owner") return reply.code(403).send({ error: "Tylko właściciel może usunąć wyjazd" });
    await prisma.group.delete({ where: { id } });
    return { ok: true };
  });

  // Opuszczenie grupy. Właściciel nie może (musi usunąć albo zostać). Nie można
  // wyjść jeśli jest się w jakimś wydatku/spłacie.
  app.post("/:id/leave", async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.authUser!.id;
    const m = await membership(id, userId);
    if (!m) return reply.code(403).send({ error: "Nie należysz do tej grupy" });
    if (m.role === "owner") return reply.code(400).send({ error: "Właściciel nie może opuścić wyjazdu — usuń go zamiast tego" });
    if (await isFinanciallyInvolved(id, userId)) {
      return reply.code(400).send({ error: "Masz już wydatki/spłaty w tym wyjeździe — nie można wyjść" });
    }
    await prisma.groupMember.delete({ where: { groupId_userId: { groupId: id, userId } } });
    return { ok: true };
  });

  // Wyrzucenie członka — tylko właściciel. Nie można wyrzucić właściciela ani osoby
  // zaangażowanej finansowo.
  app.delete("/:id/members/:userId", async (req, reply) => {
    const { id, userId: targetId } = req.params as { id: string; userId: string };
    const me = await membership(id, req.authUser!.id);
    if (!me) return reply.code(403).send({ error: "Nie należysz do tej grupy" });
    if (me.role !== "owner") return reply.code(403).send({ error: "Tylko właściciel może wyrzucać" });

    const target = await membership(id, targetId);
    if (!target) return reply.code(404).send({ error: "Tej osoby nie ma w grupie" });
    if (target.role === "owner") return reply.code(400).send({ error: "Nie można wyrzucić właściciela" });
    if (await isFinanciallyInvolved(id, targetId)) {
      return reply.code(400).send({ error: "Ta osoba ma już wydatki/spłaty — nie można jej usunąć" });
    }
    await prisma.groupMember.delete({ where: { groupId_userId: { groupId: id, userId: targetId } } });
    return { ok: true };
  });
}
