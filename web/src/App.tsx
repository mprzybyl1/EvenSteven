import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth/AuthProvider";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Claim } from "./pages/Claim";
import { Groups } from "./pages/Groups";
import { NewGroup } from "./pages/NewGroup";
import { GroupDetail } from "./pages/GroupDetail";
import { GroupSettings } from "./pages/GroupSettings";
import { AddExpense } from "./pages/AddExpense";
import { JoinGroup } from "./pages/JoinGroup";
import { Profile } from "./pages/Profile";
import { AppShell } from "./components/AppShell";

function Splash() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <img src="/logo.png" alt="" width={64} height={64} className="animate-pulse" />
    </div>
  );
}

// Trasy wymagające logowania. Niezalogowanych odsyłamy na /login, ale
// zapamiętujemy dokąd chcieli iść (np. link zaproszenia), żeby po zalogowaniu
// tam wrócić.
function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      {/* Przejęcie konta-widma — publiczne, dostępne bez logowania. */}
      <Route path="/claim/:token" element={<Claim />} />

      <Route path="/" element={<Protected><Groups /></Protected>} />
      <Route path="/groups/new" element={<Protected><NewGroup /></Protected>} />
      <Route path="/groups/:id" element={<Protected><GroupDetail /></Protected>} />
      <Route path="/groups/:id/settings" element={<Protected><GroupSettings /></Protected>} />
      <Route path="/groups/:id/expenses/new" element={<Protected><AddExpense /></Protected>} />
      <Route path="/groups/:id/expenses/:expenseId/edit" element={<Protected><AddExpense /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/join" element={<Protected><JoinGroup /></Protected>} />
      <Route path="/join/:code" element={<Protected><JoinGroup /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
