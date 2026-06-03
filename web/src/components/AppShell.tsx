import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Sidebar — widoczny tylko na lg+ */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Główna treść — na desktop z wcięciem na sidebar */}
      <div className="min-h-full lg:pl-64">
        {children}
      </div>
    </>
  );
}
