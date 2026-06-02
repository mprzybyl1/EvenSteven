import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";

function Splash() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <img src="/logo.png" alt="" width={64} height={64} className="animate-pulse" />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Splash />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
