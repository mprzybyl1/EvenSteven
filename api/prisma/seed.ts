import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

// Dane demo: 3 kumpli na wyjeździe w góry + przykładowy wydatek dzielony równo.
// Logowanie: kazik@example.com / haslo123 (i analogicznie reszta).
async function main() {
  const pass = await argon2.hash("haslo123", { type: argon2.argon2id });

  const [kazik, basia, romek] = await Promise.all([
    prisma.user.upsert({ where: { email: "kazik@example.com" }, update: {}, create: { email: "kazik@example.com", displayName: "Kazik", passwordHash: pass } }),
    prisma.user.upsert({ where: { email: "basia@example.com" }, update: {}, create: { email: "basia@example.com", displayName: "Basia", passwordHash: pass } }),
    prisma.user.upsert({ where: { email: "romek@example.com" }, update: {}, create: { email: "romek@example.com", displayName: "Romek", passwordHash: pass } }),
  ]);

  const group = await prisma.group.create({
    data: {
      name: "Bieszczady 2026",
      description: "Wypad w góry",
      baseCurrency: "PLN",
      createdById: kazik.id,
      members: {
        create: [
          { userId: kazik.id, role: "owner" },
          { userId: basia.id, role: "member" },
          { userId: romek.id, role: "member" },
        ],
      },
    },
  });

  // Kazik zapłacił 90 zł za wspólne piwo, dzielimy równo na 3 (po 30 zł).
  await prisma.expense.create({
    data: {
      groupId: group.id,
      description: "Piwo w schronisku",
      amountMinor: 9000,
      currency: "PLN",
      rateToBase: 1,
      splitMethod: "equal",
      createdById: kazik.id,
      payers: { create: [{ userId: kazik.id, amountMinor: 9000 }] },
      shares: {
        create: [
          { userId: kazik.id, amountMinor: 3000 },
          { userId: basia.id, amountMinor: 3000 },
          { userId: romek.id, amountMinor: 3000 },
        ],
      },
    },
  });

  console.log("✅ Seed gotowy. Grupa:", group.name, "| login: kazik@example.com / haslo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
