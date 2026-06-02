import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Logo } from "../components/Logo";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(email, displayName, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coś poszło nie tak");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <h1 className="mb-1 text-center text-xl font-bold text-slate-800">Załóż konto</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Wskakuj i dziel koszty z ekipą</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            type="text" placeholder="Imię / ksywka" value={displayName} required autoComplete="nickname"
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
          />
          <input
            type="email" placeholder="E-mail" value={email} required autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
          />
          <input
            type="password" placeholder="Hasło (min. 8 znaków)" value={password} required minLength={8} autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit" disabled={busy}
            className="bg-brand-gradient mt-2 rounded-xl py-3 font-semibold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Tworzę…" : "Załóż konto"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Masz już konto?{" "}
          <Link to="/login" className="font-semibold text-brand-ink">Zaloguj się</Link>
        </p>
      </div>
    </div>
  );
}
