import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../auth/AuthProvider";
import {
  CURRENCIES, useDeleteGroup, useGroup, useLeaveGroup, useRemoveMember, useUpdateGroup,
} from "../lib/groups";
import { useExpenses } from "../lib/expenses";
import { useConfirm } from "../components/Confirm";
import { useToast } from "../components/Toast";

export function GroupSettings() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: group, isLoading } = useGroup(id);
  const { data: expenses } = useExpenses(id);
  const update = useUpdateGroup(id);
  const removeMember = useRemoveMember(id);
  const deleteGroup = useDeleteGroup();
  const leaveGroup = useLeaveGroup();
  const confirm = useConfirm();
  const toast = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("PLN");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (!group || prefilled) return;
    setName(group.name);
    setDescription(group.description ?? "");
    setBaseCurrency(group.baseCurrency);
    setPrefilled(true);
  }, [group, prefilled]);

  if (isLoading || !group) {
    return (<div className="mx-auto max-w-md lg:max-w-2xl"><AppHeader title="Ustawienia" back /><p className="px-4 py-6 text-slate-400">Ładuję…</p></div>);
  }

  const isOwner = group.members.find((m) => m.userId === user?.id)?.role === "owner";
  const hasExpenses = (expenses?.length ?? 0) > 0;
  const input = "rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";

  async function save() {
    setError(null); setSaved(false);
    try {
      await update.mutateAsync({ name, description: description || null, baseCurrency });
      setSaved(true);
      toast.success("Zapisano zmiany");
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać");
    }
  }

  async function onDelete() {
    const ok = await confirm({ title: "Usunąć wyjazd?", message: `„${group!.name}" zniknie wraz ze wszystkimi wydatkami. Tego nie da się cofnąć.`, confirmText: "Usuń wyjazd", danger: true });
    if (!ok) return;
    try { await deleteGroup.mutateAsync(id); toast.success("Wyjazd usunięty"); navigate("/", { replace: true }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Nie udało się usunąć"); }
  }

  async function onLeave() {
    if (!(await confirm({ title: "Opuścić wyjazd?", message: "Przestaniesz widzieć ten wyjazd.", confirmText: "Opuść", danger: true }))) return;
    try { await leaveGroup.mutateAsync(id); toast.success("Opuściłeś wyjazd"); navigate("/", { replace: true }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Nie udało się wyjść"); }
  }

  async function onRemove(userId: string, displayName: string) {
    if (!(await confirm({ title: "Wyrzucić z wyjazdu?", message: `${displayName} straci dostęp do tego wyjazdu.`, confirmText: "Wyrzuć", danger: true }))) return;
    try { await removeMember.mutateAsync(userId); toast.success(`${displayName} usunięty`); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Nie udało się usunąć"); }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col lg:max-w-2xl">
      <AppHeader title="Ustawienia wyjazdu" back />
      <div className="flex flex-1 flex-col gap-6 px-4 py-5">
        {/* Edycja */}
        <section className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Nazwa</span>
            <input className={input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Opis</span>
            <input className={input} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Waluta</span>
            <select className={`${input} ${hasExpenses ? "opacity-60" : ""}`} value={baseCurrency} disabled={hasExpenses} onChange={(e) => setBaseCurrency(e.target.value)}>
              {[baseCurrency, ...CURRENCIES.filter((c) => c !== baseCurrency)].map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
            {hasExpenses && <span className="text-xs text-slate-400">Waluty nie zmienisz — są już wydatki.</span>}
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={save} disabled={update.isPending} className="bg-brand-gradient mt-1 rounded-xl py-3 font-semibold text-white shadow-md disabled:opacity-60">
            {update.isPending ? "Zapisuję…" : saved ? "Zapisano ✓" : "Zapisz zmiany"}
          </button>
        </section>

        {/* Członkowie */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-600">Ekipa ({group.members.length})</h2>
          <div className="flex flex-col gap-2">
            {group.members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                <div className="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white">{m.displayName.charAt(0).toUpperCase()}</div>
                <span className="flex-1 truncate text-slate-700">{m.displayName}{m.userId === user?.id ? " (Ty)" : ""}</span>
                {m.role === "owner" ? (
                  <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-xs font-semibold text-brand-green">właściciel</span>
                ) : isOwner ? (
                  <button onClick={() => onRemove(m.userId, m.displayName)} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50">Wyrzuć</button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* Strefa zagrożenia */}
        <section className="mt-auto border-t border-slate-100 pt-5">
          {isOwner ? (
            <button onClick={onDelete} disabled={deleteGroup.isPending} className="w-full rounded-xl border border-red-200 py-3 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
              Usuń wyjazd
            </button>
          ) : (
            <button onClick={onLeave} disabled={leaveGroup.isPending} className="w-full rounded-xl border border-red-200 py-3 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
              Opuść wyjazd
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
