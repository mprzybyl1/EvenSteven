import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { api, ApiError } from "../lib/api";
import { Logo } from "../components/Logo";

interface ClaimPreview {
  displayName: string;
  groups: { name: string; emoji: string | null }[];
}

// Strona przejęcia konta-widma. Ktoś dodał Cię do wyjazdu po imieniu — tutaj
// zakładasz prawdziwe konto na tej samej linijce (cała historia długów zostaje).
export function Claim() {
  const { token = "" } = useParams();
  const { claim } = useAuth();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<ClaimPreview>(`/auth/claim/${token}`)
      .then((p) => {
        if (!alive) return;
        setPreview(p);
        setDisplayName(p.displayName);
      })
      .catch((e) => {
        if (!alive) return;
        setLoadErr(e instanceof ApiError ? e.message : "Nie udało się wczytać zaproszenia");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await claim(token, email, displayName, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coś poszło nie tak");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        {loading ? (
          <p className="text-center text-slate-400">Ładuję zaproszenie…</p>
        ) : loadErr ? (
          <div className="text-center">
            <h1 className="mb-2 text-xl font-bold text-slate-800">Ups…</h1>
            <p className="mb-6 text-sm text-slate-500">{loadErr}</p>
            <Link to="/login" className="font-semibold text-brand-ink">Przejdź do logowania</Link>
          </div>
        ) : (
          <>
            <h1 className="mb-1 text-center text-xl font-bold text-slate-800">Dołącz do rozliczenia</h1>
            <p className="mb-4 text-center text-sm text-slate-500">
              Ktoś dodał Cię jako <b>{preview?.displayName}</b>
              {preview && preview.groups.length > 0 && (
                <> do {preview.groups.map((g) => `${g.emoji ? g.emoji + " " : ""}${g.name}`).join(", ")}</>
              )}
              . Załóż konto, żeby widzieć swoje saldo.
            </p>

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <input type="text" placeholder="Imię / ksywka" value={displayName} required autoComplete="nickname" maxLength={60} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} />
              <input type="email" placeholder="E-mail" value={email} required autoComplete="email" onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              <input type="password" placeholder="Hasło (min. 8 znaków)" value={password} required minLength={8} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={busy} className="bg-brand-gradient mt-2 rounded-xl py-3 font-semibold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60">
                {busy ? "Tworzę…" : "Załóż konto i dołącz"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Masz już konto?{" "}
              <Link to="/login" className="font-semibold text-brand-ink">Zaloguj się</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
