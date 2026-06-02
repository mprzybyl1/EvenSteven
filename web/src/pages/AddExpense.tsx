import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../auth/AuthProvider";
import { useGroup } from "../lib/groups";
import { CURRENCIES } from "../lib/groups";
import { useCreateExpense, type NewExpenseInput } from "../lib/expenses";
import { formatMoney, parseAmountToMinor, splitByPercent, splitEqual } from "../lib/money";

type SplitTab = "equal" | "exact" | "percent";

export function AddExpense() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: group } = useGroup(id);
  const createExpense = useCreateExpense(id);

  const members = group?.members ?? [];
  const baseCurrency = group?.baseCurrency ?? "PLN";

  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [rateStr, setRateStr] = useState("1");
  const [payerId, setPayerId] = useState<string>(user?.id ?? "");
  const [tab, setTab] = useState<SplitTab>("equal");
  const [error, setError] = useState<string | null>(null);

  // Stan podziału:
  const [participants, setParticipants] = useState<Set<string>>(new Set()); // equal
  const [exactStr, setExactStr] = useState<Record<string, string>>({}); // kwoty
  const [percentStr, setPercentStr] = useState<Record<string, string>>({}); // procenty

  // Domyślnie: wszyscy uczestniczą po równo, płaci zalogowany. Inicjalizujemy raz,
  // gdy grupa się załaduje.
  useEffect(() => {
    if (!group) return;
    setParticipants((prev) => (prev.size === 0 ? new Set(members.map((m) => m.userId)) : prev));
    setPayerId((prev) => prev || (user && members.some((m) => m.userId === user.id) ? user!.id : members[0].userId));
    setCurrency(group.baseCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  const totalMinor = parseAmountToMinor(amountStr) ?? 0;
  const rate = currency === baseCurrency ? 1 : parseFloat(rateStr.replace(",", ".")) || 0;

  // Wylicz udziały (shares) na bieżąco wg aktywnej zakładki.
  const shares = useMemo(() => {
    const out: { userId: string; amountMinor: number }[] = [];
    if (totalMinor <= 0) return out;

    if (tab === "equal") {
      const ids = members.map((m) => m.userId).filter((uid) => participants.has(uid));
      const amounts = splitEqual(totalMinor, ids.length);
      ids.forEach((uid, i) => out.push({ userId: uid, amountMinor: amounts[i] }));
    } else if (tab === "exact") {
      for (const m of members) {
        const v = parseAmountToMinor(exactStr[m.userId] ?? "");
        if (v && v > 0) out.push({ userId: m.userId, amountMinor: v });
      }
    } else {
      const ids = members.map((m) => m.userId).filter((uid) => (parseFloat(percentStr[uid] ?? "0") || 0) > 0);
      const percents = ids.map((uid) => parseFloat(percentStr[uid] ?? "0") || 0);
      const amounts = splitByPercent(totalMinor, percents);
      ids.forEach((uid, i) => out.push({ userId: uid, amountMinor: amounts[i] }));
    }
    return out;
  }, [tab, totalMinor, members, participants, exactStr, percentStr]);

  const sharesSum = shares.reduce((a, s) => a + s.amountMinor, 0);
  const diff = totalMinor - sharesSum;
  const splitOk = totalMinor > 0 && diff === 0 && shares.length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim()) return setError("Podaj opis");
    if (totalMinor <= 0) return setError("Podaj kwotę");
    if (currency !== baseCurrency && rate <= 0) return setError("Podaj kurs waluty");
    if (!payerId) return setError("Wybierz kto zapłacił");
    if (!splitOk) return setError("Podział musi sumować się do kwoty wydatku");

    const input: NewExpenseInput = {
      description: description.trim(),
      amountMinor: totalMinor,
      currency,
      rateToBase: rate,
      splitMethod: tab,
      payers: [{ userId: payerId, amountMinor: totalMinor }],
      shares,
    };
    try {
      await createExpense.mutateAsync(input);
      navigate(`/groups/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać");
    }
  }

  const input = "rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";

  function toggleParticipant(uid: string) {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <AppHeader title="Nowy wydatek" back />
      <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-4 py-5">
        <input className={input} placeholder="Na co? np. Pizza" value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} />

        {/* Kwota + waluta */}
        <div className="flex gap-2">
          <input
            className={`${input} flex-1`} inputMode="decimal" placeholder="0,00" value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
          />
          <select className={input} value={currency} onChange={(e) => { setCurrency(e.target.value); if (e.target.value === baseCurrency) setRateStr("1"); }}>
            {[baseCurrency, ...CURRENCIES.filter((c) => c !== baseCurrency)].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Kurs, gdy inna waluta niż bazowa */}
        {currency !== baseCurrency && (
          <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm">
            <span className="text-amber-800">1 {currency} =</span>
            <input className="w-24 rounded-lg border border-amber-200 px-2 py-1.5" inputMode="decimal" value={rateStr} onChange={(e) => setRateStr(e.target.value)} />
            <span className="text-amber-800">{baseCurrency}</span>
          </label>
        )}

        {/* Kto zapłacił */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Kto zapłacił?</span>
          <select className={input} value={payerId} onChange={(e) => setPayerId(e.target.value)}>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.displayName}{m.userId === user?.id ? " (Ty)" : ""}</option>
            ))}
          </select>
        </label>

        {/* Sposób podziału */}
        <div>
          <span className="text-sm font-medium text-slate-600">Jak dzielimy?</span>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {([["equal", "Po równo"], ["exact", "Kwoty"], ["percent", "Procenty"]] as const).map(([key, label]) => (
              <button
                type="button" key={key} onClick={() => setTab(key)}
                className={`rounded-lg py-2 text-sm font-medium transition ${tab === key ? "bg-white text-brand-ink shadow-sm" : "text-slate-500"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista uczestników wg trybu */}
        <div className="flex flex-col gap-1.5">
          {members.map((m) => {
            const share = shares.find((s) => s.userId === m.userId);
            return (
              <div key={m.userId} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                {tab === "equal" && (
                  <input type="checkbox" checked={participants.has(m.userId)} onChange={() => toggleParticipant(m.userId)} className="h-5 w-5 accent-[var(--color-brand-blue)]" />
                )}
                <span className="flex-1 truncate text-slate-700">{m.displayName}{m.userId === user?.id ? " (Ty)" : ""}</span>

                {tab === "equal" && (
                  <span className="text-sm tabular-nums text-slate-500">{share ? formatMoney(share.amountMinor, currency) : "—"}</span>
                )}
                {tab === "exact" && (
                  <input
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right" inputMode="decimal" placeholder="0,00"
                    value={exactStr[m.userId] ?? ""} onChange={(e) => setExactStr((p) => ({ ...p, [m.userId]: e.target.value }))}
                  />
                )}
                {tab === "percent" && (
                  <div className="flex items-center gap-1">
                    <input
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-right" inputMode="decimal" placeholder="0"
                      value={percentStr[m.userId] ?? ""} onChange={(e) => setPercentStr((p) => ({ ...p, [m.userId]: e.target.value }))}
                    />
                    <span className="text-sm text-slate-400">%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pasek kontroli sumy */}
        {totalMinor > 0 && (
          <div className={`rounded-xl px-3 py-2 text-sm font-medium ${splitOk ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {splitOk
              ? `Podział OK — ${formatMoney(totalMinor, currency)} rozdzielone`
              : diff > 0
                ? `Zostało do rozdzielenia: ${formatMoney(diff, currency)}`
                : `Za dużo o ${formatMoney(-diff, currency)}`}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit" disabled={createExpense.isPending}
          className="bg-brand-gradient mt-1 rounded-xl py-3 font-semibold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
        >
          {createExpense.isPending ? "Zapisuję…" : "Dodaj wydatek"}
        </button>
      </form>
    </div>
  );
}
