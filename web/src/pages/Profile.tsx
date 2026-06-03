import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../auth/AuthProvider";
import { disablePush, enablePush, getPushSubscription, isStandalone, pushSupported } from "../lib/push";
import { getTheme, setTheme, type Theme } from "../lib/theme";
import { useTokens, useCreateToken, useDeleteToken } from "../lib/tokens";
import { useConfirm } from "../components/Confirm";
import { useToast } from "../components/Toast";
import { Avatar } from "../components/Avatar";
import { EmojiPicker, AVATAR_EMOJIS } from "../components/EmojiPicker";

export function Profile() {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  // Motyw
  const [theme, setThemeState] = useState<Theme>(getTheme());
  function chooseTheme(t: Theme) {
    setTheme(t);
    setThemeState(t);
  }

  // Powiadomienia push
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const supported = pushSupported();
  const standalone = isStandalone();

  useEffect(() => {
    if (!supported) return;
    getPushSubscription().then((s) => setPushOn(!!s)).catch(() => {});
  }, [supported]);

  async function togglePush() {
    setPushMsg(null);
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        setPushMsg({ ok: true, text: "Powiadomienia wyłączone" });
      } else {
        await enablePush();
        setPushOn(true);
        setPushMsg({ ok: true, text: "Powiadomienia włączone ✓" });
      }
    } catch (err) {
      setPushMsg({ ok: false, text: err instanceof Error ? err.message : "Nie udało się" });
    } finally {
      setPushBusy(false);
    }
  }

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [nameBusy, setNameBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const input = "rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";

  async function saveName() {
    setNameMsg(null); setNameBusy(true);
    try {
      await updateProfile({ displayName: displayName.trim() });
      setNameMsg({ ok: true, text: "Zapisano ✓" });
    } catch (err) {
      setNameMsg({ ok: false, text: err instanceof Error ? err.message : "Nie udało się" });
    } finally { setNameBusy(false); }
  }

  // Avatar-emotka: zapisujemy od razu po wyborze (bez osobnego przycisku).
  const toast = useToast();
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(user?.avatarEmoji ?? null);
  async function chooseAvatar(emoji: string | null) {
    setAvatarEmoji(emoji);
    try {
      await updateProfile({ avatarEmoji: emoji });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się zapisać avatara");
    }
  }

  async function savePassword() {
    setPwMsg(null);
    if (newPassword.length < 8) return setPwMsg({ ok: false, text: "Nowe hasło min. 8 znaków" });
    if (newPassword !== confirmPassword) return setPwMsg({ ok: false, text: "Hasła się nie zgadzają" });
    setPwBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwMsg({ ok: true, text: "Hasło zmienione ✓" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Nie udało się" });
    } finally { setPwBusy(false); }
  }

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col lg:max-w-2xl">
      <AppHeader title="Profil" back />
      <div className="flex flex-1 flex-col gap-6 px-4 py-5">
        {/* Nagłówek konta */}
        <div className="flex items-center gap-3">
          <Avatar emoji={avatarEmoji} name={user?.displayName} className="h-14 w-14 text-2xl" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-slate-800">{user?.displayName}</p>
            <p className="truncate text-sm text-slate-400">{user?.email}</p>
          </div>
        </div>

        {/* Avatar (emotka) */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-600">Avatar</h2>
          <p className="text-xs text-slate-400">Wybierz emotkę zamiast inicjału. Możesz też wpisać/wkleić własną.</p>
          <EmojiPicker value={avatarEmoji} onChange={chooseAvatar} emojis={AVATAR_EMOJIS} />
        </section>

        {/* Ksywka */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-600">Imię / ksywka</h2>
          <input className={input} value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
          {nameMsg && <p className={`text-sm ${nameMsg.ok ? "text-green-600" : "text-red-600"}`}>{nameMsg.text}</p>}
          <button onClick={saveName} disabled={nameBusy || !displayName.trim()} className="bg-brand-gradient rounded-xl py-3 font-semibold text-white shadow-md disabled:opacity-60">
            {nameBusy ? "Zapisuję…" : "Zapisz ksywkę"}
          </button>
        </section>

        {/* Hasło */}
        <section className="flex flex-col gap-2 border-t border-slate-100 pt-5">
          <h2 className="text-sm font-semibold text-slate-600">Zmiana hasła</h2>
          <input className={input} type="password" placeholder="Aktualne hasło" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <input className={input} type="password" placeholder="Nowe hasło (min. 8)" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <input className={input} type="password" placeholder="Powtórz nowe hasło" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          {pwMsg && <p className={`text-sm ${pwMsg.ok ? "text-green-600" : "text-red-600"}`}>{pwMsg.text}</p>}
          <button onClick={savePassword} disabled={pwBusy || !currentPassword || !newPassword} className="rounded-xl border border-slate-200 py-3 font-semibold text-slate-700 disabled:opacity-50">
            {pwBusy ? "Zmieniam…" : "Zmień hasło"}
          </button>
        </section>

        {/* Wygląd */}
        <section className="flex flex-col gap-2 border-t border-slate-100 pt-5">
          <h2 className="text-sm font-semibold text-slate-600">Wygląd</h2>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {([["system", "System"], ["light", "Jasny"], ["dark", "Ciemny"]] as const).map(([key, label]) => (
              <button
                key={key} onClick={() => chooseTheme(key)}
                className={`rounded-lg py-2 text-sm font-medium transition ${theme === key ? "bg-white text-brand-ink shadow-sm" : "text-slate-500"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Powiadomienia */}
        <section className="flex flex-col gap-2 border-t border-slate-100 pt-5">
          <h2 className="text-sm font-semibold text-slate-600">Powiadomienia push</h2>
          {!supported ? (
            <p className="text-sm text-slate-400">
              Ta przeglądarka nie wspiera powiadomień.
              {/iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone && " Na iPhonie dodaj apkę do ekranu głównego (Udostępnij → Dodaj do ekranu początkowego), wtedy zadziałają."}
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-500">Dostaniesz powiadomienie, gdy ktoś doda wydatek, spłatę albo dołączy do wyjazdu.</p>
              {!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent) && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Na iPhonie push działa tylko z apki dodanej do ekranu głównego.
                </p>
              )}
              {pushMsg && <p className={`text-sm ${pushMsg.ok ? "text-green-600" : "text-red-600"}`}>{pushMsg.text}</p>}
              <button
                onClick={togglePush} disabled={pushBusy}
                className={`rounded-xl py-3 font-semibold shadow-md disabled:opacity-60 ${pushOn ? "border border-slate-200 text-slate-700" : "bg-brand-gradient text-white"}`}
              >
                {pushBusy ? "Chwila…" : pushOn ? "Wyłącz powiadomienia" : "🔔 Włącz powiadomienia"}
              </button>
            </>
          )}
        </section>

        {/* Integracje / tokeny API */}
        <section className="flex flex-col gap-2 border-t border-slate-100 pt-5">
          <TokensSection />
        </section>

        {/* Wyloguj */}
        <section className="mt-auto border-t border-slate-100 pt-5">
          <button onClick={onLogout} className="w-full rounded-xl border border-red-200 py-3 font-semibold text-red-600 hover:bg-red-50">
            Wyloguj
          </button>
        </section>
      </div>
    </div>
  );
}

// Osobiste tokeny API — do integracji zewnętrznych (np. agent AI dopisujący wydatki).
function TokensSection() {
  const { data: tokens, isLoading } = useTokens();
  const createToken = useCreateToken();
  const deleteToken = useDeleteToken();
  const confirm = useConfirm();
  const toast = useToast();

  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null); // świeżo wygenerowany plaintext (pokazany raz)

  async function generate() {
    if (!name.trim()) return;
    try {
      const res = await createToken.mutateAsync(name.trim());
      setFresh(res.token);
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się");
    }
  }

  async function copyFresh() {
    if (!fresh) return;
    try { await navigator.clipboard.writeText(fresh); toast.success("Token skopiowany ✓"); } catch { /* ignore */ }
  }

  async function revoke(id: string, label: string) {
    const ok = await confirm({ title: "Odwołać token?", message: `Token „${label}" przestanie działać. Integracje, które go używają, stracą dostęp.`, confirmText: "Odwołaj", danger: true });
    if (!ok) return;
    try { await deleteToken.mutateAsync(id); toast.success("Token odwołany"); } catch { toast.error("Nie udało się"); }
  }

  const input = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-blue";

  return (
    <>
      <h2 className="text-sm font-semibold text-slate-600">Tokeny API (integracje)</h2>
      <p className="text-xs text-slate-400">
        Token pozwala zewnętrznej automatyzacji (np. botowi dopisującemu wydatki) działać na Twoim koncie. Wysyłaj go w nagłówku <code className="rounded bg-slate-100 px-1">Authorization: Bearer …</code>
      </p>

      {/* Świeżo wygenerowany token — widoczny RAZ */}
      {fresh && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-1 text-xs font-semibold text-amber-800">Skopiuj teraz — nie pokażemy go ponownie!</p>
          <div className="flex gap-2">
            <input readOnly value={fresh} className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-700" />
            <button onClick={copyFresh} className="bg-brand-gradient shrink-0 rounded-lg px-3 text-sm font-semibold text-white">Kopiuj</button>
          </div>
          <button onClick={() => setFresh(null)} className="mt-2 text-xs font-medium text-amber-800 underline">Zapisałem, schowaj</button>
        </div>
      )}

      {/* Generowanie */}
      <div className="flex gap-2">
        <input value={name} maxLength={60} placeholder="Nazwa, np. Agent squash" onChange={(e) => setName(e.target.value)} className={`min-w-0 flex-1 ${input}`} />
        <button onClick={generate} disabled={createToken.isPending || !name.trim()} className="bg-brand-gradient shrink-0 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50">
          {createToken.isPending ? "…" : "Wygeneruj"}
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-xs text-slate-400">Ładuję…</p>
      ) : tokens && tokens.length > 0 ? (
        <div className="flex flex-col gap-2">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{t.name}</p>
                <p className="truncate font-mono text-xs text-slate-400">{t.prefix}… · {t.lastUsedAt ? "użyty " + new Date(t.lastUsedAt).toLocaleDateString("pl-PL") : "nieużywany"}</p>
              </div>
              <button onClick={() => revoke(t.id, t.name)} className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Odwołaj</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Brak tokenów.</p>
      )}
    </>
  );
}
