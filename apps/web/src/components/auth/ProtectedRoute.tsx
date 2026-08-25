"use client";

import {
  useEffect,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { getDashboardPath, type OfficerRole } from "@/lib/api";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: readonly OfficerRole[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    officer,
    officerRole,
    isAuthenticated,
    isLoading,
  } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !officer) {
      const redirectPath = pathname || "/";

      router.replace(
        `/login?next=${encodeURIComponent(redirectPath)}`,
      );

      return;
    }

    if (
      allowedRoles &&
      (!officerRole ||
        !allowedRoles.includes(officerRole))
    ) {
      router.replace(getDashboardPath(officerRole));
    }
  }, [
    allowedRoles,
    isAuthenticated,
    isLoading,
    officer,
    officerRole,
    pathname,
    router,
  ]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Checking authentication...</p>
      </main>
    );
  }

  if (!isAuthenticated || !officer) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Redirecting to login...</p>
      </main>
    );
  }

  if (
    allowedRoles &&
    (!officerRole ||
      !allowedRoles.includes(officerRole))
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Access denied.</p>
      </main>
    );
  }

  return <>{children}</>;
}
