"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  getAdminDashboard,
  type AdminDashboardResponse,
} from "@/lib/api";

function AdminDashboard() {
  const { accessToken, isLoading: authLoading } = useAuth();

  const [dashboard, setDashboard] =
    useState<AdminDashboardResponse | null>(null);

  const [dashboardLoading, setDashboardLoading] =
    useState(true);

  const [dashboardError, setDashboardError] =
    useState("");

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const token = accessToken;
    let cancelled = false;

    async function loadDashboard() {
      try {
        setDashboardError("");
        const data = await getAdminDashboard(token);

        if (!cancelled) {
          setDashboard(data);
        }
      } catch (error) {
        if (!cancelled) {
          setDashboardError(
            error instanceof Error
              ? error.message
              : "Unable to load dashboard data.",
          );
        }
      } finally {
        if (!cancelled) {
          setDashboardLoading(false);
        }
      }
    }

    void loadDashboard();

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

  const zoneDisplayName = dashboard?.zone
    ? `${dashboard.zone.zone_name} Admin Dashboard`
    : "Zonal Admin Dashboard";

  return (
    <AppLayout
      title={zoneDisplayName}
      subtitle={
        dashboard?.zone
          ? `Assigned Zone: ${dashboard.zone.zone_name} (${dashboard.zone.zone_code})`
          : "Zonal Operations Management"
      }
    >
      {/* ERROR BANNER */}
      {dashboardError && (
        <section className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">
            {dashboardError}
          </p>
        </section>
      )}

      {/* ADMINISTRATION MANAGEMENT PANELS */}
      <section className="mb-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Administration
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage zonal administration and master meter data.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* AREA ADMIN CREATION */}
          <DashboardPanel
            title="Area Admin Creation"
            description="Create a new area administrator and assign the administrator to an area within your zone."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Create Area Admin
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Add officer credentials and select area.
                </p>
              </div>

              <Link
                href="/admin/area-admin/create"
                className="inline-flex w-fit items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 sm:text-sm"
              >
                Create Area Admin
              </Link>
            </div>
          </DashboardPanel>

          {/* UPLOAD MASTER DATA */}
          <DashboardPanel
            title="Upload Master Data"
            description="Upload master meter data for your zone using a CSV or XLSX file."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Master Meter Data
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Import and update master meter records.
                </p>
              </div>

              <Link
                href="/admin/master-data"
                className="inline-flex w-fit items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 sm:text-sm"
              >
                Upload Data
              </Link>
            </div>
          </DashboardPanel>

          {/* GIS ZONE MAP */}
          <DashboardPanel
            title="GIS Zone Map"
            description="View geographical distribution of master meters across areas in your zone."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  GIS Spatial Map
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Interactive vector &amp; satellite map.
                </p>
              </div>

              <Link
                href="/admin/map"
                className="inline-flex w-fit items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 sm:text-sm"
              >
                View Map
              </Link>
            </div>
          </DashboardPanel>
        </div>
      </section>

      {/* ZONAL OVERVIEW METRICS */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Zonal Overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Overview of operations and master data within your assigned zone.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* ASSIGNED ZONE */}
          <DashboardCard
            title="Assigned Zone"
            value={
              dashboardLoading
                ? "..."
                : dashboard?.zone?.zone_name ?? "—"
            }
            description={
              dashboard?.zone
                ? `Zone Code: ${dashboard.zone.zone_code}`
                : "Assigned zone details"
            }
          />

          {/* AREAS */}
          <DashboardCard
            title="Areas"
            value={
              dashboardLoading
                ? "..."
                : String(dashboard?.summary.area_count ?? 0)
            }
            description="Areas in assigned zone"
          />

          {/* FIELD AREAS */}
          <DashboardCard
            title="Field Areas"
            value={
              dashboardLoading
                ? "..."
                : String(dashboard?.summary.field_area_count ?? 0)
            }
            description="Field areas in assigned zone"
          />

          {/* TOTAL MASTER METERS */}
          <DashboardCard
            title="Total Master Meters"
            value={
              dashboardLoading
                ? "..."
                : String(dashboard?.summary.master_meter_count ?? 0)
            }
            description="Total master meters in assigned zone"
          />
        </div>
      </section>


      {/* AREA-WISE OPERATIONS TABLE */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Area-wise Operations
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Operational data for areas within your assigned zone.
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[700px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 font-semibold">Area</th>
                <th className="px-3 py-3 font-semibold">Field Areas</th>
                <th className="px-3 py-3 font-semibold">Master Meters</th>
                <th className="px-3 py-3 font-semibold">Consumers</th>
              </tr>
            </thead>

            <tbody>
              {dashboardLoading ? (
                <tr key="loading">
                  <td
                    colSpan={4}
                    className="px-3 py-10 text-center text-slate-400"
                  >
                    Loading area data...
                  </td>
                </tr>
              ) : dashboard?.areas && dashboard.areas.length > 0 ? (
                dashboard.areas.map((area, index) => (
                  <tr
                    key={
                      area.area_id
                        ? `area-${area.area_id}`
                        : area.area_code
                          ? `area-${area.area_code}`
                          : `area-${index}`
                    }
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-3 py-4">
                      <div className="font-medium text-slate-900">
                        {area.area_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {area.area_code}
                      </div>
                    </td>

                    <td className="px-3 py-4 font-medium text-slate-700">
                      {area.field_area_count}
                    </td>

                    <td className="px-3 py-4 font-medium text-slate-700">
                      {area.master_meter_count}
                    </td>

                    <td className="px-3 py-4 font-medium text-slate-700">
                      {area.consumer_count}
                    </td>
                  </tr>
                ))
              ) : (
                <tr key="empty">
                  <td
                    colSpan={4}
                    className="px-3 py-10 text-center text-slate-400"
                  >
                    No area data available in this zone.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
}

function DashboardCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </article>
  );
}

function DashboardPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminDashboard />
    </ProtectedRoute>
  );
}