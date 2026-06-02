import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

export function AppHeader({ title, back, right }: { title?: ReactNode; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur">
      {back ? (
        <button onClick={() => navigate(-1)} className="-ml-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Wstecz">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      ) : (
        <img src="/logo.png" alt="" width={28} height={28} className="object-contain" />
      )}
      <div className="min-w-0 flex-1 truncate font-bold text-brand-ink">
        {title ?? (
          <span className="text-lg font-extrabold">
            Even<span className="text-brand-gradient">Steven</span>
          </span>
        )}
      </div>
      {right}
    </header>
  );
}
