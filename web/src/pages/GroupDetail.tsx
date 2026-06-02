import { useState } from "react";
import { useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useGroup } from "../lib/groups";

export function GroupDetail() {
  const { id = "" } = useParams();
  const { data: group, isLoading, error } = useGroup(id);
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md">
        <AppHeader back />
        <p className="px-4 py-6 text-slate-400">Ładuję…</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="mx-auto max-w-md">
        <AppHeader back />
        <p className="px-4 py-6 text-red-600">{error instanceof Error ? error.message : "Nie znaleziono grupy"}</p>
      </div>
    );
  }

  const inviteUrl = `${window.location.origin}/join/${group.inviteCode}`;

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard zablokowany — trudno, użytkownik zaznaczy ręcznie */
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <AppHeader title={group.name} back />

      <div className="flex-1 px-4 py-5">
        {group.description && <p className="mb-1 text-slate-500">{group.description}</p>}
        <span className="inline-block rounded-full bg-brand-blue/10 px-2.5 py-1 text-xs font-semibold text-brand-ink">
          Waluta: {group.baseCurrency}
        </span>

        {/* Zaproszenie */}
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">Zaproś ekipę</h2>
          <div className="flex gap-2">
            <input readOnly value={inviteUrl} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600" />
            <button onClick={copyInvite} className="bg-brand-gradient shrink-0 rounded-xl px-4 text-sm font-semibold text-white">
              {copied ? "Skopiowano!" : "Kopiuj"}
            </button>
          </div>
        </section>

        {/* Członkowie */}
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">Ekipa ({group.members.length})</h2>
          <div className="flex flex-col gap-2">
            {group.members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                <div className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">
                  {m.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{m.displayName}</p>
                  <p className="truncate text-xs text-slate-400">{m.email}</p>
                </div>
                {m.role === "owner" && (
                  <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-xs font-semibold text-brand-green">właściciel</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Wydatki — kolejny etap */}
        <section className="mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center">
          <p className="text-3xl">🧾</p>
          <p className="mt-2 font-semibold text-slate-700">Wydatki już wkrótce</p>
          <p className="mt-1 text-sm text-slate-400">Tu dodasz koszty i zobaczysz „kto komu ile”.</p>
        </section>
      </div>
    </div>
  );
}
