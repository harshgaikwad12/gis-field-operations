"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  getSuperAdminDashboard,
  type SuperAdminDashboardResponse,
} from "@/lib/api";

function SuperAdminDashboard() {
  const { accessToken, isLoading: authLoading } = useAuth();

  const [dashboard, setDashboard] =
    useState<SuperAdminDashboardResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let cancelled = false;

    async function loadData(token: string) {
      try {
        setError("");
        const data = await getSuperAdminDashboard(token);
        if (!cancelled) {
          setDashboard(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load Super Admin dashboard.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData(accessToken);

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-500">Checking authentication...</p>
      </main>
    );
  }

  const filteredZones =
    dashboard?.zones.filter(
      (z) =>
        z.zone_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        z.zone_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (z.zonal_admin?.officer_name ?? "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
    ) ?? [];

  return (
    <AppLayout
      title="Super Admin Dashboard"
      subtitle={`${dashboard?.state_name ?? "Maharashtra"} State Operations Overview`}
    >
      {/* ERROR BANNER */}
      {error && (
        <section className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </section>
      )}

      {/* STATE-WIDE OVERVIEW METRICS */}
      <section className="mb-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Maharashtra State Overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Overall operations, geographical zones, and master meter statistics across Maharashtra.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            title="Total Zones"
            value={loading ? "..." : String(dashboard?.summary.total_zones ?? 0)}
            description="Active state zones"
          />

          <MetricCard
            title="Zonal Admins"
            value={
              loading
                ? "..."
                : String(dashboard?.summary.total_zonal_admins ?? 0)
            }
            description="Assigned zonal admins"
          />

          <MetricCard
            title="Total Areas"
            value={loading ? "..." : String(dashboard?.summary.total_areas ?? 0)}
            description="State administrative areas"
          />

          <MetricCard
            title="Field Areas"
            value={
              loading ? "..." : String(dashboard?.summary.total_field_areas ?? 0)
            }
            description="Operational field areas"
          />

          <MetricCard
            title="Master Meters"
            value={
              loading
                ? "..."
                : String(dashboard?.summary.total_master_meters ?? 0)
            }
            description="Total state master meters"
          />
        </div>
      </section>

      {/* STATE ACTIONS */}
      <section className="mb-8">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <ActionCard
            title="Create Zonal Admin"
            description="Create a new administrator and assign them to a Maharashtra Zone."
            buttonText="Create Zonal Admin"
            href="/admin/zonal-admin/create"
          />

          <ActionCard
            title="Zonal Management"
            description="Manage, activate, deactivate, or unassign Zonal Administrators with live status updates."
            buttonText="Manage Zonal Admins"
            href="/super-admin/zones"
          />

          <ActionCard
            title="State GIS Map"
            description="Inspect spatial meter distribution and search coverage across all Maharashtra zones."
            buttonText="Open State Map"
            href="/super-admin/map"
          />
        </div>
      </section>
    </AppLayout>
  );
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </article>
  );
}

function ActionCard({
  title,
  description,
  buttonText,
  href,
}: {
  title: string;
  description: string;
  buttonText: string;
  href: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          {buttonText}
        </Link>
      </div>
    </section>
  );
}

export default function SuperAdminPage() {
  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
      <SuperAdminDashboard />
    </ProtectedRoute>
  );
}
