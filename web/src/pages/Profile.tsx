import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../auth/AuthProvider";
import { disablePush, enablePush, getPushSubscription, isStandalone, pushSupported } from "../lib/push";
import { getTheme, setTheme, type Theme } from "../lib/theme";

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
      await updateProfile(displayName.trim());
      setNameMsg({ ok: true, text: "Zapisano ✓" });
    } catch (err) {
      setNameMsg({ ok: false, text: err instanceof Error ? err.message : "Nie udało się" });
    } finally { setNameBusy(false); }
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
          <div className="bg-brand-gradient flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white">
            {(user?.displayName ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-slate-800">{user?.displayName}</p>
            <p className="truncate text-sm text-slate-400">{user?.email}</p>
          </div>
        </div>

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
