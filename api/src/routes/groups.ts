import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { notifyGroupExcept } from "../lib/push.js";
import { sendInviteEmail, mailEnabled } from "../lib/mail.js";
import { env } from "../env.js";

const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Kod waluty to 3 litery, np. PLN");

const emojiField = z.string().trim().max(16).optional().nullable();

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  emoji: emojiField,
  description: z.string().trim().max(300).optional(),
  baseCurrency: currencyCode,
});

const joinSchema = z.object({
  inviteCode: z.string().trim().min(1),
});

// Dodanie konta-widma (niezarejestrowanego uczestnika) — po imieniu, e-mail opcjonalny.
const addMemberSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")).transform((v) => v || undefined),
});

function newClaimToken() {
  return randomBytes(24).toString("base64url");
}

function claimUrl(token: string) {
  return `${env.APP_ORIGIN}/claim/${token}`;
}

const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  emoji: emojiField,
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
        emoji: g.emoji,
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
    const { name, emoji, description, baseCurrency } = parsed.data;

    const group = await prisma.group.create({
      data: {
        name,
        emoji: emoji || null,
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
      select: { id: true, name: true, emoji: true, baseCurrency: true, _count: { select: { members: true } } },
    });
    if (!group) return reply.code(404).send({ error: "Nie ma takiego zaproszenia" });
    return { group: { id: group.id, name: group.name, emoji: group.emoji, baseCurrency: group.baseCurrency, memberCount: group._count.members } };
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
          include: { user: { select: { id: true, displayName: true, email: true, avatarEmoji: true, isPlaceholder: true, claimToken: true } } },
        },
      },
    });
    if (!group) return reply.code(404).send({ error: "Nie znaleziono grupy" });

    return {
      group: {
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        description: group.description,
        baseCurrency: group.baseCurrency,
        inviteCode: group.inviteCode,
        createdById: group.createdById,
        createdAt: group.createdAt,
        members: group.members.map((m) => ({
          userId: m.userId,
          displayName: m.user.displayName,
          email: m.user.email,
          avatarEmoji: m.user.avatarEmoji,
          role: m.role,
          joinedAt: m.joinedAt,
          isPlaceholder: m.user.isPlaceholder,
          // Link do przejęcia konta — tylko dla widm, żeby dało się skopiować/wysłać.
          claimUrl: m.user.isPlaceholder && m.user.claimToken ? claimUrl(m.user.claimToken) : null,
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
      data: { name: parsed.data.name, emoji: parsed.data.emoji || null, description: parsed.data.description ?? null, baseCurrency: parsed.data.baseCurrency },
    });
    return { group: { id: updated.id, name: updated.name, emoji: updated.emoji, description: updated.description, baseCurrency: updated.baseCurrency } };
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

  // Dodaj konto-widmo (niezarejestrowanego uczestnika) — po samym imieniu.
  // Każdy członek grupy może to zrobić (jak dodawanie wydatku). Jeśli podasz e-mail
  // i serwer ma skonfigurowany Gmail SMTP — wyślemy zaproszenie z linkiem do przejęcia konta.
  app.post("/:id/members", async (req, reply) => {
    const { id } = req.params as { id: string };
    const me = await membership(id, req.authUser!.id);
    if (!me) return reply.code(403).send({ error: "Nie należysz do tej grupy" });

    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Podaj imię (e-mail opcjonalnie)" });
    const { name, email } = parsed.data;

    const group = await prisma.group.findUnique({ where: { id }, select: { name: true, emoji: true } });
    if (!group) return reply.code(404).send({ error: "Nie znaleziono grupy" });

    // Jeśli podano e-mail i istnieje już PRAWDZIWE konto z tym mailem — dorzućmy je
    // do grupy zamiast tworzyć widmo (bardziej intuicyjne).
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && !existing.isPlaceholder) {
        const already = await membership(id, existing.id);
        if (already) return reply.code(409).send({ error: "Ta osoba już jest w wyjeździe" });
        await prisma.groupMember.create({ data: { groupId: id, userId: existing.id, role: "member" } });
        return reply.code(201).send({
          member: { userId: existing.id, displayName: existing.displayName, email: existing.email, role: "member", isPlaceholder: false, claimUrl: null },
          invited: false,
        });
      }
    }

    // Twórz konto-widmo + dorzuć do grupy (transakcyjnie).
    const token = newClaimToken();
    const ghost = await prisma.user.create({
      data: {
        displayName: name,
        email: email ?? null,
        isPlaceholder: true,
        claimToken: token,
        memberships: { create: { groupId: id, role: "member" } },
      },
      select: { id: true, displayName: true, email: true },
    });

    // Wyślij zaproszenie mailem (jeśli jest e-mail i mail skonfigurowany) — fire-and-forget.
    let invited = false;
    if (email && mailEnabled) {
      invited = true;
      void (async () => {
        const inviter = await prisma.user.findUnique({ where: { id: req.authUser!.id }, select: { displayName: true } });
        await sendInviteEmail(email, {
          inviterName: inviter?.displayName ?? "Ktoś z ekipy",
          groupName: group.name,
          groupEmoji: group.emoji,
          claimUrl: claimUrl(token),
        });
      })().catch((e) => app.log.error(e, "wysyłka zaproszenia nie powiodła się"));
    }

    return reply.code(201).send({
      member: { userId: ghost.id, displayName: ghost.displayName, email: ghost.email, role: "member", isPlaceholder: true, claimUrl: claimUrl(token) },
      invited,
    });
  });

  // (Po)wysłanie zaproszenia do konta-widma na podany e-mail. Pozwala uzupełnić
  // e-mail widmu dodanemu wcześniej po samym imieniu i wysłać mu link.
  app.post("/:id/members/:userId/invite", async (req, reply) => {
    const { id, userId: targetId } = req.params as { id: string; userId: string };
    const me = await membership(id, req.authUser!.id);
    if (!me) return reply.code(403).send({ error: "Nie należysz do tej grupy" });

    const parsedEmail = z.string().trim().toLowerCase().email().safeParse((req.body as { email?: string })?.email);
    if (!parsedEmail.success) return reply.code(400).send({ error: "Podaj poprawny e-mail" });
    const email = parsedEmail.data;

    if (!(await membership(id, targetId))) return reply.code(404).send({ error: "Tej osoby nie ma w grupie" });
    const ghost = await prisma.user.findUnique({ where: { id: targetId } });
    if (!ghost || !ghost.isPlaceholder) return reply.code(400).send({ error: "To konto jest już aktywne" });

    // E-mail nie może należeć do innego konta.
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash && clash.id !== ghost.id) return reply.code(409).send({ error: "Ten e-mail jest już zajęty" });

    const token = ghost.claimToken ?? newClaimToken();
    await prisma.user.update({ where: { id: ghost.id }, data: { email, claimToken: token } });

    if (!mailEnabled) {
      // Mail wyłączony na serwerze — zwróć link do skopiowania ręcznie.
      return reply.send({ sent: false, claimUrl: claimUrl(token) });
    }
    const group = await prisma.group.findUnique({ where: { id }, select: { name: true, emoji: true } });
    const inviter = await prisma.user.findUnique({ where: { id: req.authUser!.id }, select: { displayName: true } });
    await sendInviteEmail(email, {
      inviterName: inviter?.displayName ?? "Ktoś z ekipy",
      groupName: group?.name ?? "wyjazd",
      groupEmoji: group?.emoji,
      claimUrl: claimUrl(token),
    });
    return reply.send({ sent: true, claimUrl: claimUrl(token) });
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

    // Jeśli to było konto-widmo i nie należy już do żadnej grupy — skasuj je (nie zostawiamy sierot).
    const ghost = await prisma.user.findUnique({
      where: { id: targetId },
      select: { isPlaceholder: true, _count: { select: { memberships: true } } },
    });
    if (ghost?.isPlaceholder && ghost._count.memberships === 0) {
      await prisma.user.delete({ where: { id: targetId } });
    }
    return { ok: true };
  });
}
