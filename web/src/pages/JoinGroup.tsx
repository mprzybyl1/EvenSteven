import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useInvitePreview, useJoinGroup } from "../lib/groups";

// Wyłuskaj sam kod z tego, co user wklei (pełny link albo goły kod).
function extractCode(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/join\/([^/?#\s]+)/);
  return match ? match[1] : trimmed;
}

export function JoinGroup() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [raw, setRaw] = useState("");

  // Tryb 1: brak kodu w URL -> formularz wklejenia linku.
  if (!code) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col">
        <AppHeader title="Dołącz do wyjazdu" back />
        <div className="flex flex-1 flex-col gap-4 px-4 py-6">
          <p className="text-sm text-slate-500">Wklej link zaproszenia, który dostałeś od ekipy.</p>
          <input
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
            placeholder="https://…/join/abc123 albo sam kod"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <button
            disabled={!raw.trim()}
            onClick={() => navigate(`/join/${extractCode(raw)}`)}
            className="bg-brand-gradient rounded-xl py-3 font-semibold text-white shadow-md disabled:opacity-50"
          >
            Dalej
          </button>
        </div>
      </div>
    );
  }

  return <JoinPreview code={code} />;
}

function JoinPreview({ code }: { code: string }) {
  const navigate = useNavigate();
  const { data: group, isLoading, error } = useInvitePreview(code);
  const joinGroup = useJoinGroup();
  const [joinError, setJoinError] = useState<string | null>(null);

  async function confirm() {
    setJoinError(null);
    try {
      const res = await joinGroup.mutateAsync(code);
      navigate(`/groups/${res.group.id}`, { replace: true });
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Nie udało się dołączyć");
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <AppHeader title="Dołącz do wyjazdu" back />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center">
        {isLoading && <p className="text-slate-400">Sprawdzam zaproszenie…</p>}

        {error && (
          <div>
            <p className="text-4xl">🤷</p>
            <p className="mt-2 font-semibold text-slate-700">Nieprawidłowe zaproszenie</p>
            <p className="mt-1 text-sm text-slate-400">Link wygasł albo jest błędny.</p>
          </div>
        )}

        {group && (
          <div className="w-full">
            <p className="text-5xl">{group.emoji || "🏔️"}</p>
            <h1 className="mt-3 text-xl font-bold text-slate-800">{group.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {group.memberCount} {group.memberCount === 1 ? "osoba" : "os."} · waluta {group.baseCurrency}
            </p>
            {joinError && <p className="mt-4 text-sm text-red-600">{joinError}</p>}
            <button
              onClick={confirm} disabled={joinGroup.isPending}
              className="bg-brand-gradient mt-6 w-full rounded-xl py-3 font-semibold text-white shadow-md disabled:opacity-60"
            >
              {joinGroup.isPending ? "Dołączam…" : "Dołącz do ekipy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
