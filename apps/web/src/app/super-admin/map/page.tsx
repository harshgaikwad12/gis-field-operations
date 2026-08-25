"use client";

import { useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GisMap } from "@/components/gis/GisMap";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  getSuperAdminDashboard,
  type SuperAdminDashboardResponse,
} from "@/lib/api";

export default function SuperAdminMapPage() {
  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
      <SuperAdminMapContent />
    </ProtectedRoute>
  );
}

function SuperAdminMapContent() {
  const { accessToken } = useAuth();
  const [dashboard, setDashboard] =
    useState<SuperAdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!accessToken) return;

    setLoading(true);
    getSuperAdminDashboard(accessToken)
      .then(setDashboard)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading && !dashboard) {
    return (
      <AppLayout title="State GIS Map" subtitle="Loading Maharashtra spatial map...">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900" />
            <p className="text-sm text-slate-500">Loading state vector map...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !dashboard) {
    return (
      <AppLayout title="State GIS Map" subtitle="Maharashtra State Operations">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-2xl">⚠️</p>
            <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!dashboard) return null;

  const totalMeters = dashboard.meters?.length ?? 0;
  const filteredMetersCount = (dashboard.meters ?? []).filter((m) => {
    const matchesZone =
      !selectedZone ||
      (m.zone_name ?? "").toLowerCase() === selectedZone.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      m.meter_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.consumer_name ?? "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (m.zone_name ?? "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesZone && matchesSearch;
  }).length;

  return (
    <AppLayout
      title="State GIS Map"
      subtitle={`${dashboard.state_name} State Spatial Master Meter Overview`}
    >
      {/* Top Controls Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0f172a] text-2xl text-white shadow-xs">
            🗺️
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Maharashtra State Master Meter Map
            </h2>
            <p className="text-xs text-slate-500">
              Total Mapped Meters: <strong>{totalMeters}</strong> across{" "}
              <strong>{dashboard.zones.length}</strong> active zones
            </p>
          </div>
        </div>

        {/* Zone Selector & Search */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Zone Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="zone-select" className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Zone:
            </label>
            <select
              id="zone-select"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="">All Maharashtra Zones ({dashboard.zones.length})</option>
              {dashboard.zones.map((z, idx) => (
                <option key={`zone-opt-${z.id ?? z.zone_code ?? idx}`} value={z.zone_name}>
                  {z.zone_name} ({z.zone_code})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Search */}
          <input
            type="text"
            placeholder="Search by Meter or Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-64 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:bg-white"
          />

          {selectedZone && (
            <button
              type="button"
              onClick={() => setSelectedZone("")}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Reset Zone ✕
            </button>
          )}
        </div>
      </div>

      {/* Full-Height Google-style GIS Vector Map */}
      <div className="w-full">
        <GisMap
          meters={dashboard.meters ?? []}
          height="h-[calc(100vh-230px)] min-h-[500px]"
          selectedZoneFilter={selectedZone}
          externalSearch={searchQuery}
          showFilters={false}
          showGps={false}
          showInternalSearch={false}
          enableRouting={false}
        />
      </div>
    </AppLayout>
  );
}
