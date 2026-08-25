"use client";

import { useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GisMap } from "@/components/gis/GisMap";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  getAreaAdminDashboard,
  type AreaAdminDashboardResponse,
} from "@/lib/api";

export default function AreaAdminMapPage() {
  return (
    <ProtectedRoute allowedRoles={["AREA_ADMIN", "SUPER_ADMIN"]}>
      <AreaAdminMapContent />
    </ProtectedRoute>
  );
}

function AreaAdminMapContent() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<AreaAdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFieldAreaFilter, setSelectedFieldAreaFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDashboard = () => {
    if (!accessToken) return;
    setLoading(true);
    getAreaAdminDashboard(accessToken)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, [accessToken]);

  if (loading) {
    return (
      <AppLayout title="Area GIS Map" subtitle="Loading GIS Map View...">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900" />
            <p className="text-sm text-slate-500">Loading Area GIS Map...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Area GIS Map" subtitle="Area Operations Portal">
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

  // Filter meters if field area selected
  const allMeters = data.meters ?? [];
  const filteredMeters = allMeters.filter((m) => {
    if (!selectedFieldAreaFilter) return true;
    return (m.field_area_name ?? "").toLowerCase() === selectedFieldAreaFilter.toLowerCase();
  });

  return (
    <AppLayout
      title={`${data.area_name} GIS Spatial Map`}
      subtitle={`Geographical distribution of master meters across ${data.area_name} (${data.zone_name})`}
    >
      {/* Header Banner & Filter */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f172a] text-xl text-white shadow-xs">
            🗺️
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {data.area_name} GIS Map Workspace
            </h2>
            <p className="text-xs text-slate-500">
              Area Code: <strong>{data.area_code}</strong> &bull; Total Meters: <strong>{allMeters.length}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Field Area Selector */}
          {data.field_areas && data.field_areas.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">
                Filter Field Area:
              </label>
              <select
                value={selectedFieldAreaFilter}
                onChange={(e) => setSelectedFieldAreaFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="">All Field Areas ({data.field_areas.length})</option>
                {data.field_areas.map((fa, idx) => (
                  <option key={`fa-opt-${fa.id ?? fa.field_area_code ?? idx}`} value={fa.field_area_name}>
                    {fa.field_area_name} ({fa.field_area_code})
                  </option>
                ))}
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

      {/* Full-Height GIS Map Viewport (Routing & GPS disabled for Area Admin) */}
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
