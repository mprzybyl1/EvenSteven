import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Kod waluty to 3 litery");

// Pozycja: kto i ile (w groszach waluty wydatku).
const lineSchema = z.object({
  userId: z.string().min(1),
  amountMinor: z.number().int().nonnegative(),
});

const createExpenseSchema = z.object({
  description: z.string().trim().min(1).max(120),
  amountMinor: z.number().int().positive(),
  currency: currencyCode,
  rateToBase: z.number().positive().default(1),
  splitMethod: z.enum(["equal", "exact", "percent", "shares"]).default("equal"),
  date: z.coerce.date().optional(),
  category: z.string().trim().max(40).optional(),
  payers: z.array(lineSchema).min(1),
  shares: z.array(lineSchema).min(1),
});

const settlementSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  date: z.coerce.date().optional(),
  note: z.string().trim().max(120).optional(),
});

function sum(lines: { amountMinor: number }[]) {
  return lines.reduce((acc, l) => acc + l.amountMinor, 0);
}

// Walidacja spójności wydatku — wspólna dla tworzenia i edycji.
// Zwraca komunikat błędu albo null gdy OK.
function expensePayloadError(
  data: { amountMinor: number; payers: { userId: string; amountMinor: number }[]; shares: { userId: string; amountMinor: number }[] },
  members: Set<string>,
): string | null {
  if (sum(data.payers) !== data.amountMinor) return "Suma wpłat płatników musi równać się kwocie wydatku";
  if (sum(data.shares) !== data.amountMinor) return "Suma udziałów musi równać się kwocie wydatku";
  const payerIds = data.payers.map((p) => p.userId);
  const shareIds = data.shares.map((s) => s.userId);
  if (new Set(payerIds).size !== payerIds.length || new Set(shareIds).size !== shareIds.length) {
    return "Powtórzona osoba w płatnikach lub udziałach";
  }
  for (const uid of [...payerIds, ...shareIds]) {
    if (!members.has(uid)) return "Ktoś spoza grupy w wydatku";
  }
  return null;
}

export async function expenseRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  // Strażnik: czy zalogowany user należy do grupy z URL? Jak nie -> 403.
  async function assertMember(groupId: string, userId: string, reply: import("fastify").FastifyReply) {
    const m = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!m) {
      reply.code(403).send({ error: "Nie należysz do tej grupy" });
      return false;
    }
    return true;
  }

  // Zbiór userId należących do grupy (do walidacji pozycji).
  async function memberIds(groupId: string) {
    const ms = await prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } });
    return new Set(ms.map((m) => m.userId));
  }

  // --- WYDATKI ---

  app.get("/:groupId/expenses", async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    if (!(await assertMember(groupId, req.authUser!.id, reply))) return;

    const expenses = await prisma.expense.findMany({
      where: { groupId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        payers: { include: { user: { select: { id: true, displayName: true } } } },
        shares: { include: { user: { select: { id: true, displayName: true } } } },
      },
    });
    return { expenses };
  });

  app.post("/:groupId/expenses", async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    if (!(await assertMember(groupId, req.authUser!.id, reply))) return;

    const parsed = createExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Błędne dane", details: z.treeifyError(parsed.error) });
    }
    const data = parsed.data;

    const validationError = expensePayloadError(data, await memberIds(groupId));
    if (validationError) return reply.code(400).send({ error: validationError });

    const expense = await prisma.expense.create({
      data: {
        groupId,
        description: data.description,
        amountMinor: data.amountMinor,
        currency: data.currency,
        rateToBase: data.rateToBase,
        splitMethod: data.splitMethod,
        date: data.date ?? new Date(),
        category: data.category,
        createdById: req.authUser!.id,
        payers: { create: data.payers.map((p) => ({ userId: p.userId, amountMinor: p.amountMinor })) },
        shares: { create: data.shares.map((s) => ({ userId: s.userId, amountMinor: s.amountMinor })) },
      },
    });
    return reply.code(201).send({ expense });
  });

  app.get("/:groupId/expenses/:expenseId", async (req, reply) => {
    const { groupId, expenseId } = req.params as { groupId: string; expenseId: string };
    if (!(await assertMember(groupId, req.authUser!.id, reply))) return;
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, groupId },
      include: {
        payers: { include: { user: { select: { id: true, displayName: true } } } },
        shares: { include: { user: { select: { id: true, displayName: true } } } },
      },
    });
    if (!expense) return reply.code(404).send({ error: "Nie ma takiego wydatku" });
    return { expense };
  });

  app.put("/:groupId/expenses/:expenseId", async (req, reply) => {
    const { groupId, expenseId } = req.params as { groupId: string; expenseId: string };
    if (!(await assertMember(groupId, req.authUser!.id, reply))) return;

    const exists = await prisma.expense.findFirst({ where: { id: expenseId, groupId } });
    if (!exists) return reply.code(404).send({ error: "Nie ma takiego wydatku" });

    const parsed = createExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Błędne dane", details: z.treeifyError(parsed.error) });
    }
    const data = parsed.data;

    const validationError = expensePayloadError(data, await memberIds(groupId));
    if (validationError) return reply.code(400).send({ error: validationError });

    // Edycja = podmiana pozycji. Kasujemy stare payers/shares i wstawiamy nowe,
    // wszystko w jednej transakcji żeby nie zostawić niespójnego stanu.
    const [, , expense] = await prisma.$transaction([
      prisma.expensePayer.deleteMany({ where: { expenseId } }),
      prisma.expenseShare.deleteMany({ where: { expenseId } }),
      prisma.expense.update({
        where: { id: expenseId },
        data: {
          description: data.description,
          amountMinor: data.amountMinor,
          currency: data.currency,
          rateToBase: data.rateToBase,
          splitMethod: data.splitMethod,
          date: data.date ?? exists.date,
          category: data.category,
          payers: { create: data.payers.map((p) => ({ userId: p.userId, amountMinor: p.amountMinor })) },
          shares: { create: data.shares.map((s) => ({ userId: s.userId, amountMinor: s.amountMinor })) },
        },
      }),
    ]);
    return reply.send({ expense });
  });

  app.delete("/:groupId/expenses/:expenseId", async (req, reply) => {
    const { groupId, expenseId } = req.params as { groupId: string; expenseId: string };
    if (!(await assertMember(groupId, req.authUser!.id, reply))) return;
    const exp = await prisma.expense.findFirst({ where: { id: expenseId, groupId } });
    if (!exp) return reply.code(404).send({ error: "Nie ma takiego wydatku" });
    await prisma.expense.delete({ where: { id: expenseId } });
    return { ok: true };
  });

  // --- SPŁATY ---

  app.post("/:groupId/settlements", async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    if (!(await assertMember(groupId, req.authUser!.id, reply))) return;

    const parsed = settlementSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Błędne dane" });
    const d = parsed.data;
    if (d.fromUserId === d.toUserId) return reply.code(400).send({ error: "Spłata do samego siebie nie ma sensu" });

    const members = await memberIds(groupId);
    if (!members.has(d.fromUserId) || !members.has(d.toUserId)) {
      return reply.code(400).send({ error: "Ktoś spoza grupy w spłacie" });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { baseCurrency: true } });
    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        fromUserId: d.fromUserId,
        toUserId: d.toUserId,
        amountMinor: d.amountMinor,
        currency: group!.baseCurrency, // spłaty trzymamy w walucie bazowej grupy
        date: d.date ?? new Date(),
        note: d.note,
      },
    });
    return reply.code(201).send({ settlement });
  });

  app.get("/:groupId/settlements", async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    if (!(await assertMember(groupId, req.authUser!.id, reply))) return;
    const settlements = await prisma.settlement.findMany({
      where: { groupId },
      orderBy: { date: "desc" },
      include: {
        fromUser: { select: { id: true, displayName: true } },
        toUser: { select: { id: true, displayName: true } },
      },
    });
    return { settlements };
  });

  // --- SALDA + "kto komu ile" ---

  app.get("/:groupId/balances", async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    if (!(await assertMember(groupId, req.authUser!.id, reply))) return;

    const [group, expenses, settlements] = await Promise.all([
      prisma.group.findUnique({
        where: { id: groupId },
        include: { members: { include: { user: { select: { id: true, displayName: true } } } } },
      }),
      prisma.expense.findMany({ where: { groupId }, include: { payers: true, shares: true } }),
      prisma.settlement.findMany({ where: { groupId } }),
    ]);
    if (!group) return reply.code(404).send({ error: "Nie znaleziono grupy" });

    // net[u] = ile grupa jest mu winna (dodatnie = wierzyciel, ujemne = dłużnik), w groszach waluty bazowej.
    const net = new Map<string, number>();
    for (const m of group.members) net.set(m.userId, 0);

    for (const e of expenses) {
      // Przeliczamy NET pojedynczej osoby z waluty wydatku do bazowej (mniejszy dryf zaokrągleń niż osobno wpłaty/udziały).
      const paid = new Map<string, number>();
      for (const p of e.payers) paid.set(p.userId, (paid.get(p.userId) ?? 0) + p.amountMinor);
      const owed = new Map<string, number>();
      for (const s of e.shares) owed.set(s.userId, (owed.get(s.userId) ?? 0) + s.amountMinor);
      const everyone = new Set([...paid.keys(), ...owed.keys()]);
      for (const uid of everyone) {
        const deltaCurrency = (paid.get(uid) ?? 0) - (owed.get(uid) ?? 0);
        const deltaBase = Math.round(deltaCurrency * e.rateToBase);
        net.set(uid, (net.get(uid) ?? 0) + deltaBase);
      }
    }

    for (const s of settlements) {
      // A (from) płaci B (to): A "wyrównuje" dług -> jego saldo rośnie; B dostaje kasę -> maleje.
      net.set(s.fromUserId, (net.get(s.fromUserId) ?? 0) + s.amountMinor);
      net.set(s.toUserId, (net.get(s.toUserId) ?? 0) - s.amountMinor);
    }

    const nameOf = new Map(group.members.map((m) => [m.userId, m.user.displayName]));
    const balances = [...net.entries()].map(([userId, amountMinor]) => ({
      userId,
      displayName: nameOf.get(userId) ?? "?",
      amountMinor,
    }));

    // "Kto komu ile" — zachłanne wyrównanie: najwięksi dłużnicy płacą największym wierzycielom.
    const debtors = balances.filter((b) => b.amountMinor < 0).map((b) => ({ ...b, rem: -b.amountMinor })).sort((a, b) => b.rem - a.rem);
    const creditors = balances.filter((b) => b.amountMinor > 0).map((b) => ({ ...b, rem: b.amountMinor })).sort((a, b) => b.rem - a.rem);
    const transactions: { fromUserId: string; fromName: string; toUserId: string; toName: string; amountMinor: number }[] = [];
    let di = 0, ci = 0;
    while (di < debtors.length && ci < creditors.length) {
      const d = debtors[di], c = creditors[ci];
      const pay = Math.min(d.rem, c.rem);
      if (pay > 0) {
        transactions.push({ fromUserId: d.userId, fromName: d.displayName, toUserId: c.userId, toName: c.displayName, amountMinor: pay });
        d.rem -= pay;
        c.rem -= pay;
      }
      if (d.rem === 0) di++;
      if (c.rem === 0) ci++;
    }

    return { baseCurrency: group.baseCurrency, balances, transactions };
  });
}
