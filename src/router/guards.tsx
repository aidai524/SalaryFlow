import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

export function RequireAuth() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function RequireAdmin() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/my-pay" replace />;
  }

  return <Outlet />;
}

export function RequireEmployee() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "employee") {
    return <Navigate to="/pay" replace />;
  }

  return <Outlet />;
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);

  if (user) {
    return <Navigate to={user.role === "admin" ? "/pay" : "/my-pay"} replace />;
  }

  return children;
}

export function HomeRedirect() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === "admin" ? "/pay" : "/my-pay"} replace />;
}
