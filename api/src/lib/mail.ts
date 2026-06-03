// Wysyłka maili przez Gmail SMTP (app-password). Bez własnego serwera pocztowego.
//
// Konfiguracja: w .env ustaw GMAIL_USER (pełny adres) + GMAIL_APP_PASSWORD
// (16-znakowe hasło aplikacji z https://myaccount.google.com/apppasswords — wymaga
// włączonego 2FA na koncie Google). Bez kompletu tych zmiennych wysyłka jest WYŁĄCZONA
// (funkcje to no-op), więc apka działa też bez maila — tak jak push.
import nodemailer from "nodemailer";
import { env } from "../env.js";

export const mailEnabled = Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);

const transport = mailEnabled
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.GMAIL_USER!, pass: env.GMAIL_APP_PASSWORD! },
    })
  : null;

const FROM = `EvenSteven <${env.GMAIL_USER ?? "noreply@example.com"}>`;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Prosty, czytelny szablon w stylu marki (zieleń→błękit).
function wrap(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  const button = cta
    ? `<a href="${cta.url}" style="display:inline-block;margin-top:8px;padding:12px 22px;border-radius:12px;background:linear-gradient(135deg,#5dbb46,#3aa6d0);color:#fff;font-weight:600;text-decoration:none">${escapeHtml(cta.label)}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f9fb;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <div style="font-size:22px;font-weight:800;color:#1f6fa5;margin-bottom:20px">Even<span style="color:#3aa6d0">Steven</span></div>
    <div style="background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <h1 style="margin:0 0 12px;font-size:18px">${escapeHtml(title)}</h1>
      ${bodyHtml}
      ${button}
    </div>
    <p style="color:#94a3b8;font-size:12px;margin-top:20px">EvenSteven — dzielenie kosztów wyjazdów bez bólu głowy.</p>
  </div></body></html>`;
}

// Zaproszenie do wyjazdu z linkiem do przejęcia konta-widma (claim).
export async function sendInviteEmail(
  to: string,
  opts: { inviterName: string; groupName: string; groupEmoji?: string | null; claimUrl: string },
) {
  if (!transport) return;
  const niceGroup = `${opts.groupEmoji ? opts.groupEmoji + " " : ""}${opts.groupName}`;
  const subject = `${opts.inviterName} zaprasza Cię do rozliczenia „${opts.groupName}" w EvenSteven`;
  const bodyHtml = `<p style="margin:0 0 8px;color:#475569"><b>${escapeHtml(opts.inviterName)}</b> dodał(a) Cię do wspólnego rozliczenia <b>${escapeHtml(niceGroup)}</b>.</p>
    <p style="margin:0 0 16px;color:#475569">Załóż szybko konto, żeby widzieć kto komu ile jest winien i odhaczać spłaty.</p>`;
  const text = `${opts.inviterName} dodał(a) Cię do rozliczenia "${opts.groupName}" w EvenSteven.\nZałóż konto: ${opts.claimUrl}`;
  await transport.sendMail({
    from: FROM,
    to,
    subject,
    text,
    html: wrap("Dołącz do rozliczenia", bodyHtml, { label: "Załóż konto i dołącz", url: opts.claimUrl }),
  });
}
