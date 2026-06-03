import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useGroups } from "../lib/groups";

export function Sidebar() {
  const { user, logout } = useAuth();
  const { data: groups } = useGroups();
  const location = useLocation();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
        <img src="/logo.png" alt="" width={32} height={32} className="object-contain" />
        <span className="text-lg font-extrabold text-brand-ink">
          Even<span className="bg-gradient-to-r from-brand-green to-brand-blue bg-clip-text text-transparent">Steven</span>
        </span>
      </div>

      {/* User */}
      <Link
        to="/profile"
        className={`mx-3 mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition hover:bg-slate-50 ${location.pathname === "/profile" ? "bg-brand-blue/10" : ""}`}
      >
        <div className="bg-brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
          {(user?.displayName ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{user?.displayName}</p>
          <p className="truncate text-xs text-slate-400">{user?.email}</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Wyjazdy</p>

        {groups?.map((g) => {
          const active = location.pathname.startsWith(`/groups/${g.id}`);
          return (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-brand-blue/10 text-brand-ink" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <span className="truncate">{g.emoji ? g.emoji + " " : ""}{g.name}</span>
              <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{g.baseCurrency}</span>
            </Link>
          );
        })}

        {groups?.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-400">Nie masz jeszcze wyjazdów.</p>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col gap-2 border-t border-slate-100 p-3">
        <Link
          to="/groups/new"
          className="bg-brand-gradient block rounded-xl py-2.5 text-center text-sm font-semibold text-white shadow-sm"
        >
          + Nowy wyjazd
        </Link>
        <Link
          to="/join"
          className="block rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Dołącz przez link
        </Link>
        <button
          onClick={onLogout}
          className="rounded-xl py-2 text-xs font-medium text-slate-400 hover:text-red-500 transition"
        >
          Wyloguj
        </button>
      </div>
    </aside>
  );
}
