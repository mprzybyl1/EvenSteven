import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { CURRENCIES, useCreateGroup } from "../lib/groups";

export function NewGroup() {
  const navigate = useNavigate();
  const createGroup = useCreateGroup();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("PLN");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const group = await createGroup.mutateAsync({ name, description: description || undefined, baseCurrency });
      navigate(`/groups/${group.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć");
    }
  }

  const input = "rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col lg:max-w-2xl">
      <AppHeader title="Nowy wyjazd" back />
      <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-4 py-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Nazwa</span>
          <input className={input} placeholder="np. Bieszczady 2026" value={name} required maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Opis <span className="text-slate-400">(opcjonalnie)</span></span>
          <input className={input} placeholder="Wypad w góry" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Waluta rozliczenia</span>
          <select className={input} value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400">Do tej waluty sprowadzimy wszystkie salda. Wydatki możesz dodawać też w innych.</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit" disabled={createGroup.isPending}
          className="bg-brand-gradient mt-2 rounded-xl py-3 font-semibold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
        >
          {createGroup.isPending ? "Tworzę…" : "Utwórz wyjazd"}
        </button>
      </form>
    </div>
  );
}
