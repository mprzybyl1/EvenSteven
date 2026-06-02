import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../auth/AuthProvider";
import { useGroup, CURRENCIES } from "../lib/groups";
import { useCreateExpense, useExpense, useUpdateExpense, type NewExpenseInput } from "../lib/expenses";
import { formatMoney, minorToInputString, parseAmountToMinor, splitByPercent, splitEqual } from "../lib/money";

type SplitTab = "equal" | "exact" | "percent";
type PayerMode = "single" | "multi";

export function AddExpense() {
  const { id = "", expenseId } = useParams();
  const isEdit = !!expenseId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: group } = useGroup(id);
  const { data: editing } = useExpense(id, expenseId);
  const createExpense = useCreateExpense(id);
  const updateExpense = useUpdateExpense(id, expenseId ?? "");

  const members = group?.members ?? [];
  const baseCurrency = group?.baseCurrency ?? "PLN";

  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [rateStr, setRateStr] = useState("1");
  const [tab, setTab] = useState<SplitTab>("equal");
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Płatnicy
  const [payerMode, setPayerMode] = useState<PayerMode>("single");
  const [payerId, setPayerId] = useState("");
  const [payerAmountStr, setPayerAmountStr] = useState<Record<string, string>>({});

  // Podział
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [exactStr, setExactStr] = useState<Record<string, string>>({});
  const [percentStr, setPercentStr] = useState<Record<string, string>>({});

  // Inicjalizacja / prefill. Czeka aż grupa (i wydatek przy edycji) się załadują.
  useEffect(() => {
    if (!group || prefilled) return;
    if (isEdit && !editing) return;

    if (isEdit && editing) {
      const total = editing.amountMinor;
      setDescription(editing.description);
      setAmountStr(minorToInputString(editing.amountMinor));
      setCurrency(editing.currency);
      setRateStr(String(editing.rateToBase));
      const method: SplitTab = editing.splitMethod === "percent" ? "percent" : editing.splitMethod === "equal" ? "equal" : "exact";
      setTab(method);

      if (method === "equal") {
        setParticipants(new Set(editing.shares.map((s) => s.userId)));
      } else if (method === "percent") {
        const pcts: Record<string, string> = {};
        for (const s of editing.shares) pcts[s.userId] = total > 0 ? ((s.amountMinor / total) * 100).toFixed(2).replace(".", ",") : "0";
        setPercentStr(pcts);
      } else {
        const ex: Record<string, string> = {};
        for (const s of editing.shares) ex[s.userId] = minorToInputString(s.amountMinor);
        setExactStr(ex);
      }

      if (editing.payers.length > 1) {
        setPayerMode("multi");
        const pa: Record<string, string> = {};
        for (const p of editing.payers) pa[p.userId] = minorToInputString(p.amountMinor);
        setPayerAmountStr(pa);
      } else {
        setPayerMode("single");
        setPayerId(editing.payers[0]?.userId ?? "");
      }
    } else {
      // Nowy wydatek: domyślnie wszyscy po równo, płaci zalogowany.
      setCurrency(group.baseCurrency);
      setParticipants(new Set(members.map((m) => m.userId)));
      setPayerId(user && members.some((m) => m.userId === user.id) ? user.id : members[0]?.userId ?? "");
    }
    setPrefilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id, editing?.id, isEdit]);

  const totalMinor = parseAmountToMinor(amountStr) ?? 0;
  const rate = currency === baseCurrency ? 1 : parseFloat(rateStr.replace(",", ".")) || 0;

  // Płatnicy -> rozwiązane pozycje
  const payers = useMemo(() => {
    if (payerMode === "single") {
      return payerId ? [{ userId: payerId, amountMinor: totalMinor }] : [];
    }
    const out: { userId: string; amountMinor: number }[] = [];
    for (const m of members) {
      const v = parseAmountToMinor(payerAmountStr[m.userId] ?? "");
      if (v && v > 0) out.push({ userId: m.userId, amountMinor: v });
    }
    return out;
  }, [payerMode, payerId, totalMinor, members, payerAmountStr]);

  const payersSum = payers.reduce((a, p) => a + p.amountMinor, 0);
  const payersDiff = totalMinor - payersSum;
  const payersOk = payerMode === "single" ? !!payerId && totalMinor > 0 : totalMinor > 0 && payersDiff === 0 && payers.length > 0;

  // Udziały -> rozwiązane pozycje
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
      const ids = members.map((m) => m.userId).filter((uid) => (parseFloat((percentStr[uid] ?? "0").replace(",", ".")) || 0) > 0);
      const percents = ids.map((uid) => parseFloat((percentStr[uid] ?? "0").replace(",", ".")) || 0);
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
    if (!payersOk) return setError("Suma wpłat płatników musi równać się kwocie");
    if (!splitOk) return setError("Podział musi sumować się do kwoty wydatku");

    const input: NewExpenseInput = {
      description: description.trim(),
      amountMinor: totalMinor,
      currency,
      rateToBase: rate,
      splitMethod: tab,
      payers,
      shares,
    };
    try {
      if (isEdit) await updateExpense.mutateAsync(input);
      else await createExpense.mutateAsync(input);
      navigate(`/groups/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać");
    }
  }

  const input = "rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";
  const busy = createExpense.isPending || updateExpense.isPending;

  function toggleParticipant(uid: string) {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  }

  function switchPayerMode(mode: PayerMode) {
    // Przy wejściu w tryb wielu płatników zasiej obecnego płatnika pełną kwotą.
    if (mode === "multi" && Object.keys(payerAmountStr).length === 0 && payerId && totalMinor > 0) {
      setPayerAmountStr({ [payerId]: minorToInputString(totalMinor) });
    }
    setPayerMode(mode);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <AppHeader title={isEdit ? "Edytuj wydatek" : "Nowy wydatek"} back />
      <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-4 py-5">
        <input className={input} placeholder="Na co? np. Pizza" value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)} />

        {/* Kwota + waluta */}
        <div className="flex gap-2">
          <input className={`${input} flex-1`} inputMode="decimal" placeholder="0,00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
          <select className={input} value={currency} onChange={(e) => { setCurrency(e.target.value); if (e.target.value === baseCurrency) setRateStr("1"); }}>
            {[baseCurrency, ...CURRENCIES.filter((c) => c !== baseCurrency)].map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>

        {currency !== baseCurrency && (
          <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm">
            <span className="text-amber-800">1 {currency} =</span>
            <input className="w-24 rounded-lg border border-amber-200 px-2 py-1.5" inputMode="decimal" value={rateStr} onChange={(e) => setRateStr(e.target.value)} />
            <span className="text-amber-800">{baseCurrency}</span>
          </label>
        )}

        {/* Kto zapłacił */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Kto zapłacił?</span>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-xs">
              <button type="button" onClick={() => switchPayerMode("single")} className={`rounded-md px-2 py-1 font-medium ${payerMode === "single" ? "bg-white text-brand-ink shadow-sm" : "text-slate-500"}`}>Jeden</button>
              <button type="button" onClick={() => switchPayerMode("multi")} className={`rounded-md px-2 py-1 font-medium ${payerMode === "multi" ? "bg-white text-brand-ink shadow-sm" : "text-slate-500"}`}>Kilku</button>
            </div>
          </div>

          {payerMode === "single" ? (
            <select className={`${input} w-full`} value={payerId} onChange={(e) => setPayerId(e.target.value)}>
              {members.map((m) => (<option key={m.userId} value={m.userId}>{m.displayName}{m.userId === user?.id ? " (Ty)" : ""}</option>))}
            </select>
          ) : (
            <div className="flex flex-col gap-1.5">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                  <span className="flex-1 truncate text-slate-700">{m.displayName}{m.userId === user?.id ? " (Ty)" : ""}</span>
                  <input className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right" inputMode="decimal" placeholder="0,00"
                    value={payerAmountStr[m.userId] ?? ""} onChange={(e) => setPayerAmountStr((p) => ({ ...p, [m.userId]: e.target.value }))} />
                </div>
              ))}
              {totalMinor > 0 && (
                <div className={`rounded-lg px-3 py-1.5 text-xs font-medium ${payersOk ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {payersOk ? "Wpłaty OK" : payersDiff > 0 ? `Brakuje wpłat: ${formatMoney(payersDiff, currency)}` : `Wpłat za dużo o ${formatMoney(-payersDiff, currency)}`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sposób podziału */}
        <div>
          <span className="text-sm font-medium text-slate-600">Jak dzielimy?</span>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {([["equal", "Po równo"], ["exact", "Kwoty"], ["percent", "Procenty"]] as const).map(([key, label]) => (
              <button type="button" key={key} onClick={() => setTab(key)} className={`rounded-lg py-2 text-sm font-medium transition ${tab === key ? "bg-white text-brand-ink shadow-sm" : "text-slate-500"}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {members.map((m) => {
            const share = shares.find((s) => s.userId === m.userId);
            return (
              <div key={m.userId} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                {tab === "equal" && (<input type="checkbox" checked={participants.has(m.userId)} onChange={() => toggleParticipant(m.userId)} className="h-5 w-5 accent-[var(--color-brand-blue)]" />)}
                <span className="flex-1 truncate text-slate-700">{m.displayName}{m.userId === user?.id ? " (Ty)" : ""}</span>
                {tab === "equal" && (<span className="text-sm tabular-nums text-slate-500">{share ? formatMoney(share.amountMinor, currency) : "—"}</span>)}
                {tab === "exact" && (<input className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right" inputMode="decimal" placeholder="0,00" value={exactStr[m.userId] ?? ""} onChange={(e) => setExactStr((p) => ({ ...p, [m.userId]: e.target.value }))} />)}
                {tab === "percent" && (
                  <div className="flex items-center gap-1">
                    <input className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-right" inputMode="decimal" placeholder="0" value={percentStr[m.userId] ?? ""} onChange={(e) => setPercentStr((p) => ({ ...p, [m.userId]: e.target.value }))} />
                    <span className="text-sm text-slate-400">%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {totalMinor > 0 && (
          <div className={`rounded-xl px-3 py-2 text-sm font-medium ${splitOk ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {splitOk ? `Podział OK — ${formatMoney(totalMinor, currency)} rozdzielone` : diff > 0 ? `Zostało do rozdzielenia: ${formatMoney(diff, currency)}` : `Za dużo o ${formatMoney(-diff, currency)}`}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={busy} className="bg-brand-gradient mt-1 rounded-xl py-3 font-semibold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60">
          {busy ? "Zapisuję…" : isEdit ? "Zapisz zmiany" : "Dodaj wydatek"}
        </button>
      </form>
    </div>
  );
}
