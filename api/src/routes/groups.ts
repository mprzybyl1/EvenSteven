import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Kod waluty to 3 litery, np. PLN");

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  baseCurrency: currencyCode,
});

const joinSchema = z.object({
  inviteCode: z.string().trim().min(1),
});

// Pomocnik: czy user jest członkiem grupy? Zwraca membership albo null.
async function membership(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
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
}
