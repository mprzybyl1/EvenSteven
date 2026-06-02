import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => setState({ opts, resolve }));
  }, []);

  function close(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  const o = state?.opts;

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {o && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => close(false)}>
          <div className="animate-rise w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {o.title && <h3 className="mb-1 text-lg font-bold text-slate-800">{o.title}</h3>}
            <p className="text-slate-600">{o.message}</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => close(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 font-semibold text-slate-600">
                {o.cancelText ?? "Anuluj"}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 rounded-xl py-2.5 font-semibold text-white shadow-md ${o.danger ? "bg-red-500" : "bg-brand-gradient"}`}
              >
                {o.confirmText ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm musi być wewnątrz <ConfirmProvider>");
  return ctx;
}
