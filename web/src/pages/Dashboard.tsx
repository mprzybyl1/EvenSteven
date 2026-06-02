import { useAuth } from "../auth/AuthProvider";
import { Logo } from "../components/Logo";

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <Logo size={36} withText={false} />
        <span className="text-lg font-extrabold text-brand-ink">
          Even<span className="text-brand-gradient">Steven</span>
        </span>
        <button
          onClick={() => logout()}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          Wyloguj
        </button>
      </header>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Zalogowany jako</p>
        <p className="text-xl font-bold text-slate-800">{user?.displayName}</p>
        <p className="text-sm text-slate-400">{user?.email}</p>
      </div>

      <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
        <p className="text-4xl">🏔️</p>
        <p className="mt-2 font-semibold text-slate-700">Tu wkrótce: Twoje wyjazdy</p>
        <p className="mt-1 text-sm text-slate-400">
          Grupy, wydatki i „kto komu ile” — kolejny etap budowy.
        </p>
      </div>
    </div>
  );
}
