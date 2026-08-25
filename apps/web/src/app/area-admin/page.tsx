"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  getAreaAdminDashboard,
  type AreaAdminDashboardResponse,
} from "@/lib/api";

function AreaAdminDashboard() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const [dashboard, setDashboard] = useState<AreaAdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let cancelled = false;

    async function loadData(token: string) {
      try {
        setError("");
        const data = await getAreaAdminDashboard(token);
        if (!cancelled) {
          setDashboard(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load Area Admin dashboard.",
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

  const areaTitle = dashboard
    ? `${dashboard.area_name} — Area Admin Dashboard`
    : "Area Admin Dashboard";

  const areaSubtitle = dashboard
    ? `Assigned Scope: ${dashboard.zone_name} / ${dashboard.area_name}`
    : "Supervisor Operations Management";

  return (
    <AppLayout title={areaTitle} subtitle={areaSubtitle}>
      {/* ERROR BANNER */}
      {error && (
        <section className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </section>
      )}

      {/* QUICK ACTIONS / OPERATIONS PANEL */}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Area Field Operations
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage field wards, configure officer assignments, and monitor spatial GIS boundaries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/area-admin/map"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
            >
              <span>🗺️</span>
              <span>GIS Area Map</span>
            </Link>

            <Link
              href="/area-admin/field-areas"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-100"
            >
              <span>🏢</span>
              <span>Field Area Management</span>
            </Link>

            <Link
              href="/area-admin/field-officer/create"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800"
            >
              <span>👤</span>
              <span>Create Field Officer</span>
            </Link>
          </div>
        </div>
      </section>

      {/* AREA-WIDE OVERVIEW METRICS */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Area Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Real-time operational metrics for your assigned administrative area.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Field Areas"
            value={loading ? "..." : String(dashboard?.summary.field_areas ?? 0)}
            description="Operational wards/sub-sectors"
          />

          <MetricCard
            title="Field Officers"
            value={loading ? "..." : String(dashboard?.summary.field_officers ?? 0)}
            description="Active field technicians"
          />

          <MetricCard
            title="Master Meters"
            value={loading ? "..." : String(dashboard?.summary.master_meters ?? 0)}
            description="Assigned boundary meters"
          />

          <MetricCard
            title="Pending Consumers"
            value={loading ? "..." : String(dashboard?.summary.pending_consumers ?? 0)}
            description="Awaiting action in this Area"
          />
        </div>
      </section>

      {/* QUICK WORKSPACE NAVIGATION CARDS */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/area-admin/field-areas"
          className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-slate-300 hover:shadow-md"
        >
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl text-blue-600">
              🏢
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
              Field Area Management
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              View and manage all wards within {dashboard?.area_name ?? "your area"}, assign or update field officers, and toggle operational status.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1 text-xs font-bold text-blue-600">
            <span>Manage Field Wards</span>
            <span className="transition group-hover:translate-x-1">&rarr;</span>
          </div>
        </Link>

        <Link
          href="/area-admin/map"
          className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-slate-300 hover:shadow-md"
        >
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl text-emerald-600">
              🗺️
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-emerald-600 transition">
              GIS Area Spatial Map
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Explore high-resolution spatial distribution of master meters, view boundary overlays, and filter by operational wards.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1 text-xs font-bold text-emerald-600">
            <span>Open Spatial Map</span>
            <span className="transition group-hover:translate-x-1">&rarr;</span>
          </div>
        </Link>
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
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-3xl font-extrabold text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </article>
  );
}

export default function AreaAdminPage() {
  return (
    <ProtectedRoute allowedRoles={["AREA_ADMIN", "SUPER_ADMIN"]}>
      <AreaAdminDashboard />
    </ProtectedRoute>
  );
}
