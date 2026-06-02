import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../auth/AuthProvider";
import { useGroup, type GroupMember } from "../lib/groups";
import {
  useBalances, useCreateSettlement, useDeleteExpense, useDeleteSettlement, useExpenses, useSettlements,
  type SettleTx,
} from "../lib/expenses";
import { formatMoney, parseAmountToMinor } from "../lib/money";
import { categoryMeta } from "../lib/categories";
import { formatDate, dayKey } from "../lib/dates";
import { useConfirm } from "../components/Confirm";
import { useToast } from "../components/Toast";

type Tab = "expenses" | "balances" | "team";

export function GroupDetail() {
  const { id = "" } = useParams();
  const { data: group, isLoading, error } = useGroup(id);
  const [tab, setTab] = useState<Tab>("expenses");

  if (isLoading) {
    return (<div className="mx-auto max-w-md"><AppHeader back /><p className="px-4 py-6 text-slate-400">Ładuję…</p></div>);
  }
  if (error || !group) {
    return (<div className="mx-auto max-w-md"><AppHeader back /><p className="px-4 py-6 text-red-600">{error instanceof Error ? error.message : "Nie znaleziono grupy"}</p></div>);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <AppHeader
        title={group.name}
        back
        right={
          <Link to={`/groups/${id}/settings`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Ustawienia">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </Link>
        }
      />

      {/* Zakładki */}
      <div className="grid grid-cols-3 gap-1 border-b border-slate-100 bg-white px-4 pb-2 pt-1">
        {([["expenses", "Wydatki"], ["balances", "Salda"], ["team", "Ekipa"]] as const).map(([key, label]) => (
          <button
            key={key} onClick={() => setTab(key)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${tab === key ? "bg-brand-blue/10 text-brand-ink" : "text-slate-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4">
        {tab === "expenses" && <ExpensesTab groupId={id} baseCurrency={group.baseCurrency} />}
        {tab === "balances" && <BalancesTab groupId={id} members={group.members} />}
        {tab === "team" && <TeamTab inviteCode={group.inviteCode} members={group.members} />}
      </div>

      {tab === "expenses" && (
        <div className="sticky bottom-0 border-t border-slate-100 bg-white/90 p-4 backdrop-blur">
          <Link to={`/groups/${id}/expenses/new`} className="bg-brand-gradient block rounded-xl py-3 text-center font-semibold text-white shadow-md">
            + Dodaj wydatek
          </Link>
        </div>
      )}
    </div>
  );
}

function ExpensesTab({ groupId, baseCurrency }: { groupId: string; baseCurrency: string }) {
  const { data: expenses, isLoading } = useExpenses(groupId);
  const del = useDeleteExpense(groupId);
  const confirm = useConfirm();
  const toast = useToast();

  async function removeExpense(id: string, description: string) {
    if (!(await confirm({ title: "Usunąć wydatek?", message: `„${description}" zniknie z rozliczenia.`, confirmText: "Usuń", danger: true }))) return;
    del.mutate(id, { onSuccess: () => toast.success("Wydatek usunięty") });
  }

  if (isLoading) return <p className="text-slate-400">Ładuję…</p>;
  if (!expenses || expenses.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
        <p className="text-3xl">🧾</p>
        <p className="mt-2 font-semibold text-slate-700">Brak wydatków</p>
        <p className="mt-1 text-sm text-slate-400">Dodaj pierwszy przyciskiem na dole.</p>
      </div>
    );
  }

  // Podsumowanie wg kategorii (w walucie bazowej grupy), największe pierwsze.
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const e of expenses) {
    const base = Math.round(e.amountMinor * e.rateToBase);
    total += base;
    byCategory.set(e.category ?? "other", (byCategory.get(e.category ?? "other") ?? 0) + base);
  }
  const breakdown = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  // Grupowanie po dniach (expenses są już posortowane malejąco po dacie).
  const groups: { key: string; label: string; items: typeof expenses }[] = [];
  for (const e of expenses) {
    const k = dayKey(e.date);
    let g = groups.find((x) => x.key === k);
    if (!g) { g = { key: k, label: formatDate(e.date), items: [] }; groups.push(g); }
    g.items.push(e);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 rounded-xl bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Razem</span>
          <span className="font-bold tabular-nums text-slate-800">{formatMoney(total, baseCurrency)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {breakdown.map(([key, amt]) => {
            const c = categoryMeta(key);
            return (
              <span key={key} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {c.emoji} {formatMoney(amt, baseCurrency)}
              </span>
            );
          })}
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-2">
          <p className="mt-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.label}</p>
          {g.items.map((e) => {
            const payerNames = e.payers.map((p) => p.user?.displayName).filter(Boolean).join(", ");
            const cat = categoryMeta(e.category);
            return (
              <div key={e.id} className="animate-list-item flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
                <Link to={`/groups/${groupId}/expenses/${e.id}/edit`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg" title={cat.label}>{cat.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{e.description}</p>
                    <p className="truncate text-xs text-slate-400">
                      {payerNames} zapłacił{e.payers.length > 1 ? "i" : ""} · dzielone na {e.shares.length}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-slate-800">{formatMoney(e.amountMinor, e.currency)}</p>
                    {e.currency !== baseCurrency && (
                      <p className="text-xs text-slate-400">≈ {formatMoney(Math.round(e.amountMinor * e.rateToBase), baseCurrency)}</p>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => removeExpense(e.id, e.description)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500" aria-label="Usuń"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function BalancesTab({ groupId, members }: { groupId: string; members: GroupMember[] }) {
  const { data, isLoading } = useBalances(groupId);
  const { data: settlements } = useSettlements(groupId);
  const settle = useCreateSettlement(groupId);
  const delSettle = useDeleteSettlement(groupId);
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);

  if (isLoading || !data) return <p className="text-slate-400">Liczę…</p>;

  const base = data.baseCurrency;

  async function doSettle(t: SettleTx) {
    const ok = await confirm({
      title: "Rozliczyć?",
      message: `${t.fromName} → ${t.toName}: ${formatMoney(t.amountMinor, base)}. Zapisać jako spłatę?`,
      confirmText: "Rozlicz",
    });
    if (!ok) return;
    settle.mutate(
      { fromUserId: t.fromUserId, toUserId: t.toUserId, amountMinor: t.amountMinor },
      { onSuccess: () => toast.success("Rozliczone!") },
    );
  }

  async function removeSettlement(id: string) {
    if (!(await confirm({ title: "Usunąć spłatę?", message: "Saldo zostanie przeliczone.", confirmText: "Usuń", danger: true }))) return;
    delSettle.mutate(id, { onSuccess: () => toast.success("Spłata usunięta") });
  }

  const myBalance = data.balances.find((b) => b.userId === user?.id)?.amountMinor ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Twoje saldo — wyróżnione */}
      <div className={`animate-rise rounded-2xl p-5 text-center shadow-sm ${myBalance > 0 ? "bg-green-50" : myBalance < 0 ? "bg-red-50" : "bg-white"}`}>
        <p className="text-sm text-slate-500">Twoje saldo</p>
        <p className={`mt-0.5 text-3xl font-extrabold tabular-nums ${myBalance > 0 ? "text-green-600" : myBalance < 0 ? "text-red-500" : "text-slate-400"}`}>
          {myBalance === 0 ? "0,00" : `${myBalance > 0 ? "+" : ""}${formatMoney(myBalance, base)}`}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {myBalance > 0 ? "tyle Ci oddadzą 🤑" : myBalance < 0 ? "tyle musisz oddać" : "jesteś na czysto 🎉"}
        </p>
      </div>

      {/* Salda osób */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Salda</h2>
        <div className="flex flex-col gap-2">
          {data.balances.map((b) => {
            const isMe = b.userId === user?.id;
            const zero = b.amountMinor === 0;
            return (
              <div key={b.userId} className={`flex items-center justify-between rounded-xl p-3 shadow-sm ${isMe ? "bg-brand-blue/5 ring-1 ring-brand-blue/20" : "bg-white"}`}>
                <span className="font-medium text-slate-700">{b.displayName}{isMe ? " (Ty)" : ""}</span>
                <span className={`font-semibold tabular-nums ${zero ? "text-slate-400" : b.amountMinor > 0 ? "text-green-600" : "text-red-500"}`}>
                  {zero ? "na czysto" : `${b.amountMinor > 0 ? "+" : ""}${formatMoney(b.amountMinor, base)}`}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">Dodatnie = grupa wisi tej osobie. Ujemne = ta osoba wisi grupie.</p>
      </section>

      {/* Kto komu ile */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Kto komu ile</h2>
        {data.transactions.length === 0 ? (
          <div className="rounded-xl bg-green-50 p-4 text-center text-green-700">🎉 Wszyscy na czysto!</div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.transactions.map((t, i) => (
              <div key={i} className="animate-list-item flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium text-slate-700">{t.fromName}</span>
                  <span className="text-slate-400"> → </span>
                  <span className="font-medium text-slate-700">{t.toName}</span>
                </span>
                <span className="font-semibold tabular-nums text-slate-800">{formatMoney(t.amountMinor, base)}</span>
                <button onClick={() => doSettle(t)} disabled={settle.isPending} className="shrink-0 rounded-lg bg-brand-green/15 px-3 py-1.5 text-sm font-semibold text-brand-green disabled:opacity-50">
                  Rozlicz
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ręczna spłata */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600">Spłaty</h2>
          <button onClick={() => setShowForm((v) => !v)} className="text-sm font-semibold text-brand-ink">
            {showForm ? "Anuluj" : "+ Zapisz spłatę"}
          </button>
        </div>

        {showForm && (
          <ManualSettleForm
            members={members} base={base} currentUserId={user?.id}
            pending={settle.isPending}
            onSubmit={(input) => settle.mutate(input, { onSuccess: () => { setShowForm(false); toast.success("Spłata zapisana"); } })}
          />
        )}

        {settlements && settlements.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2">
            {settlements.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-600">{s.fromUser.displayName} → {s.toUser.displayName}</span>
                <span className="font-medium tabular-nums text-slate-700">{formatMoney(s.amountMinor, s.currency)}</span>
                <button
                  onClick={() => removeSettlement(s.id)}
                  className="shrink-0 rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-500" aria-label="Usuń spłatę"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          !showForm && <p className="text-sm text-slate-400">Brak spłat. Rozlicz powyżej albo dodaj ręcznie.</p>
        )}
      </section>
    </div>
  );
}

function ManualSettleForm({
  members, base, currentUserId, pending, onSubmit,
}: {
  members: GroupMember[];
  base: string;
  currentUserId?: string;
  pending: boolean;
  onSubmit: (input: { fromUserId: string; toUserId: string; amountMinor: number }) => void;
}) {
  const [fromId, setFromId] = useState(currentUserId ?? members[0]?.userId ?? "");
  const [toId, setToId] = useState(members.find((m) => m.userId !== (currentUserId ?? members[0]?.userId))?.userId ?? "");
  const [amountStr, setAmountStr] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const sel = "rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-brand-blue";

  function submit() {
    setErr(null);
    const amt = parseAmountToMinor(amountStr);
    if (fromId === toId) return setErr("Wybierz dwie różne osoby");
    if (!amt || amt <= 0) return setErr("Podaj kwotę");
    onSubmit({ fromUserId: fromId, toUserId: toId, amountMinor: amt });
  }

  return (
    <div className="mb-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <select className={`${sel} min-w-0 flex-1`} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
        </select>
        <span className="text-slate-400">→</span>
        <select className={`${sel} min-w-0 flex-1`} value={toId} onChange={(e) => setToId(e.target.value)}>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
        </select>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input className={`${sel} flex-1`} inputMode="decimal" placeholder={`Kwota (${base})`} value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
        <button onClick={submit} disabled={pending} className="bg-brand-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          Zapisz
        </button>
      </div>
      {err && <p className="mt-1.5 text-sm text-red-600">{err}</p>}
    </div>
  );
}

function TeamTab({ inviteCode, members }: { inviteCode: string; members: { userId: string; displayName: string; email: string; role: string }[] }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/join/${inviteCode}`;

  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Zaproś ekipę</h2>
        <div className="flex gap-2">
          <input readOnly value={inviteUrl} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600" />
          <button onClick={copyInvite} className="bg-brand-gradient shrink-0 rounded-xl px-4 text-sm font-semibold text-white">{copied ? "Skopiowano!" : "Kopiuj"}</button>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Ekipa ({members.length})</h2>
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">{m.displayName.charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{m.displayName}</p>
                <p className="truncate text-xs text-slate-400">{m.email}</p>
              </div>
              {m.role === "owner" && <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-xs font-semibold text-brand-green">właściciel</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
