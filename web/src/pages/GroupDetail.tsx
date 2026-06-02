import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../auth/AuthProvider";
import { useGroup } from "../lib/groups";
import {
  useBalances, useCreateSettlement, useDeleteExpense, useExpenses, useSettlements,
  type SettleTx,
} from "../lib/expenses";
import { formatMoney } from "../lib/money";

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
      <AppHeader title={group.name} back />

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
        {tab === "balances" && <BalancesTab groupId={id} />}
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

  return (
    <div className="flex flex-col gap-2">
      {expenses.map((e) => {
        const payerNames = e.payers.map((p) => p.user?.displayName).filter(Boolean).join(", ");
        return (
          <div key={e.id} className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
            <Link to={`/groups/${groupId}/expenses/${e.id}/edit`} className="flex min-w-0 flex-1 items-center gap-3">
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
              onClick={() => { if (confirm(`Usunąć "${e.description}"?`)) del.mutate(e.id); }}
              className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500" aria-label="Usuń"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function BalancesTab({ groupId }: { groupId: string }) {
  const { data, isLoading } = useBalances(groupId);
  const { data: settlements } = useSettlements(groupId);
  const settle = useCreateSettlement(groupId);
  const { user } = useAuth();

  if (isLoading || !data) return <p className="text-slate-400">Liczę…</p>;

  const base = data.baseCurrency;

  function doSettle(t: SettleTx) {
    if (!confirm(`${t.fromName} → ${t.toName}: ${formatMoney(t.amountMinor, base)}.\nOznaczyć jako rozliczone?`)) return;
    settle.mutate({ fromUserId: t.fromUserId, toUserId: t.toUserId, amountMinor: t.amountMinor });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Salda osób */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Salda</h2>
        <div className="flex flex-col gap-2">
          {data.balances.map((b) => {
            const isMe = b.userId === user?.id;
            const zero = b.amountMinor === 0;
            return (
              <div key={b.userId} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
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
              <div key={i} className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
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

      {/* Historia spłat */}
      {settlements && settlements.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-600">Spłaty</h2>
          <div className="flex flex-col gap-2">
            {settlements.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
                <span className="text-slate-600">{s.fromUser.displayName} → {s.toUser.displayName}</span>
                <span className="font-medium tabular-nums text-slate-700">{formatMoney(s.amountMinor, s.currency)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
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
