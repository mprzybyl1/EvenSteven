import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useGroups } from "../lib/groups";
import { AppHeader } from "../components/AppHeader";

export function Groups() {
  const { user } = useAuth();
  const { data: groups, isLoading } = useGroups();

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col lg:max-w-2xl">
      <div className="lg:hidden">
        <AppHeader
          right={
            <Link to="/profile" className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" aria-label="Profil">
              {(user?.displayName ?? "?").charAt(0).toUpperCase()}
            </Link>
          }
        />
      </div>

      <div className="flex-1 px-4 py-5 lg:px-8 lg:py-8">
        <p className="text-sm text-slate-500">Cześć, {user?.displayName} 👋</p>
        <h1 className="mb-5 text-2xl font-bold text-slate-800">Twoje wyjazdy</h1>

        {isLoading && <p className="text-slate-400">Ładuję…</p>}

        {!isLoading && groups && groups.length === 0 && (
          <div className="animate-rise mt-6 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <p className="text-5xl">🏔️</p>
            <p className="mt-3 font-semibold text-slate-700">Czas na pierwszy wyjazd!</p>
            <p className="mt-1 text-sm text-slate-400">Załóż wspólne rozliczenie albo dołącz do ekipy przez link od kumpla.</p>
            <Link to="/groups/new" className="bg-brand-gradient mt-5 inline-block rounded-xl px-5 py-2.5 font-semibold text-white shadow-md">
              + Nowy wyjazd
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {groups?.map((g) => (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className="animate-list-item flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm transition active:scale-[0.99]"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800">{g.name}</p>
                <p className="truncate text-sm text-slate-400">
                  {g.memberCount} {g.memberCount === 1 ? "osoba" : "os."} · {g.expenseCount} wydatk.
                </p>
              </div>
              <span className="ml-3 shrink-0 rounded-full bg-brand-blue/10 px-2.5 py-1 text-xs font-semibold text-brand-ink">
                {g.baseCurrency}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white/90 p-4 backdrop-blur lg:hidden">
        <Link to="/join" className="flex-1 rounded-xl border border-slate-200 py-3 text-center font-semibold text-slate-600">
          Dołącz przez link
        </Link>
        <Link to="/groups/new" className="bg-brand-gradient flex-1 rounded-xl py-3 text-center font-semibold text-white shadow-md">
          + Nowy wyjazd
        </Link>
      </div>
    </div>
  );
}
