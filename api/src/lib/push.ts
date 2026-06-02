import webpush from "web-push";
import { prisma } from "../db.js";
import { env } from "../env.js";

// Push działa tylko gdy mamy komplet kluczy VAPID. Bez nich wszystko jest no-opem
// (apka działa normalnie, po prostu bez powiadomień).
export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// Wyślij powiadomienie do podanych użytkowników (na wszystkie ich urządzenia).
// Wygasłe subskrypcje (404/410) sprzątamy. Błędy nie wywalają flow — to fire-and-forget.
export async function notifyUsers(userIds: string[], payload: PushPayload) {
  if (!pushEnabled || userIds.length === 0) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  const data = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }),
  );
}

// Powiadom wszystkich członków grupy POZA autorem akcji.
export async function notifyGroupExcept(groupId: string, exceptUserId: string, payload: PushPayload) {
  const members = await prisma.groupMember.findMany({
    where: { groupId, NOT: { userId: exceptUserId } },
    select: { userId: true },
  });
  await notifyUsers(members.map((m) => m.userId), payload);
}

// Format kwoty do treści powiadomienia (grosze -> "50.00 PLN").
export function amountLabel(amountMinor: number, currency: string) {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}
