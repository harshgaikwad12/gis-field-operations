"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getDashboardPath } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const { officer, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && officer?.role) {
      router.replace(getDashboardPath(officer.role));
    }
  }, [isAuthenticated, isLoading, officer, router]);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm font-medium text-slate-500">
          Redirecting to your dashboard...
        </p>
      </div>
    </ProtectedRoute>
  );
}
