import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth/AuthProvider";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Groups } from "./pages/Groups";
import { NewGroup } from "./pages/NewGroup";
import { GroupDetail } from "./pages/GroupDetail";
import { AddExpense } from "./pages/AddExpense";
import { JoinGroup } from "./pages/JoinGroup";

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
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      <Route path="/" element={<Protected><Groups /></Protected>} />
      <Route path="/groups/new" element={<Protected><NewGroup /></Protected>} />
      <Route path="/groups/:id" element={<Protected><GroupDetail /></Protected>} />
      <Route path="/groups/:id/expenses/new" element={<Protected><AddExpense /></Protected>} />
      <Route path="/join" element={<Protected><JoinGroup /></Protected>} />
      <Route path="/join/:code" element={<Protected><JoinGroup /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
