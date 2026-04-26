// src/components/ProtectedRoute.tsx
import { FC, ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];          // e.g. ["super admin"]
}

/**
 * 1. Reads the user from **localStorage** (you already store it as "pos-user")
 * 2. Checks the role **case-insensitively** (trim + lowerCase)
 * 3. If the user is missing or the role is not allowed → redirect to /login
 *    preserving the original URL (so you can redirect back after login)
 */
const ProtectedRoute: FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const location = useLocation();

  // -----------------------------------------------------------------
  // 1. Securely parse the stored user (never trust localStorage)
  // -----------------------------------------------------------------
  let rawUser: string | null = null;
  try {
    rawUser = localStorage.getItem("pos-user");
  } catch (_) {
    /* ignore – localStorage may be disabled */
  }

  let posUser: any = null;
  if (rawUser) {
    try {
      posUser = JSON.parse(rawUser);
    } catch (_) {
      // corrupted JSON → treat as not logged in
    }
  }

  // -----------------------------------------------------------------
  // 2. Role check
  // -----------------------------------------------------------------
  const userRole = typeof posUser?.role === "string"
    ? posUser.role.trim().toLowerCase()
    : "";

  const hasPermission = allowedRoles
    .map(r => r.trim().toLowerCase())
    .includes(userRole);

  // -----------------------------------------------------------------
  // 3. Redirect logic
  // -----------------------------------------------------------------
  if (!posUser || !hasPermission) {
    // Save where the user tried to go → after login you can redirect back
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}   // optional: use it in your login page
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;