"use client";

import { useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GisMap } from "@/components/gis/GisMap";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  getAdminDashboard,
  type AdminDashboardResponse,
} from "@/lib/api";

export default function ZonalAdminMapPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
      <ZonalAdminMapContent />
    </ProtectedRoute>
  );
}

function ZonalAdminMapContent() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDashboard = () => {
    if (!accessToken) return;
    setLoading(true);
    getAdminDashboard(accessToken)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, [accessToken]);

  if (loading) {
    return (
      <AppLayout title="Zonal GIS Map" subtitle="Loading GIS Map View...">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900" />
            <p className="text-sm text-slate-500">Loading Zonal GIS Map...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Zonal GIS Map" subtitle="Zonal Operations Portal">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-2xl">⚠️</p>
            <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!data) return null;

  // Filter meters if area selected
  const allMeters = data.meters ?? [];
  const filteredMeters = allMeters.filter((m) => {
    if (!selectedAreaFilter) return true;
    return (m.area_name ?? "").toLowerCase() === selectedAreaFilter.toLowerCase();
  });

  return (
    <AppLayout
      title={`${data.zone?.zone_name ?? "Zonal"} GIS Spatial Map`}
      subtitle={`Geographical distribution of master meters across ${data.zone?.zone_name ?? "assigned Zone"}`}
    >
      {/* Header Banner & Filter */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f172a] text-xl text-white shadow-xs">
            🗺️
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {data.zone?.zone_name ?? "Zone"} GIS Spatial Distribution
            </h2>
            <p className="text-xs text-slate-500">
              Zone Code: <strong>{data.zone?.zone_code || data.zone?.code || "MH-ZONE"}</strong> &bull; Total Meters: <strong>{allMeters.length}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Area Selector */}
          {data.areas && data.areas.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">
                Filter Area:
              </label>
              <select
                value={selectedAreaFilter}
                onChange={(e) => setSelectedAreaFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="">All Areas ({data.areas.length})</option>
                {data.areas.map((a, idx) => {
                  const areaKey = `area-opt-${a.area_id ?? a.id ?? a.code ?? a.area_code ?? idx}`;
                  const areaName = a.area_name ?? a.name ?? "";
                  const areaCode = a.area_code ?? a.code ?? "";
                  return (
                    <option key={areaKey} value={areaName}>
                      {areaName} {areaCode ? `(${areaCode})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Quick Search */}
          <input
            type="text"
            placeholder="Search meters or consumers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>
      </div>

      {/* Full-Height GIS Map Viewport (Routing & GPS disabled for Zonal Admin) */}
      <div className="w-full">
        <GisMap
          meters={filteredMeters}
          height="h-[calc(100vh-230px)] min-h-[500px]"
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
