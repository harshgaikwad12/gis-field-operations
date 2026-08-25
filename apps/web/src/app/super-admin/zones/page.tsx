"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  getSuperAdminDashboard,
  updateZonalAdminStatus,
  updateZoneStatus,
  type SuperAdminDashboardResponse,
  type SuperAdminZoneDetail,
} from "@/lib/api";

export default function ZonalManagementPage() {
  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
      <ZonalManagementContent />
    </ProtectedRoute>
  );
}

function ZonalManagementContent() {
  const { accessToken } = useAuth();
  const [dashboard, setDashboard] =
    useState<SuperAdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE" | "UNASSIGNED">("ALL");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchDashboardData = () => {
    if (!accessToken) return;
    setLoading(true);
    getSuperAdminDashboard(accessToken)
      .then(setDashboard)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();
  }, [accessToken]);

  const handleAdminStatusChange = async (
    officerId: number,
    newStatus: "ACTIVE" | "INACTIVE" | "DELETED",
    adminName: string,
  ) => {
    if (!accessToken) return;

    if (
      newStatus === "DELETED" &&
      !window.confirm(
        `Are you sure you want to unassign/remove Zonal Admin "${adminName}"?`,
      )
    ) {
      return;
    }

    setUpdatingId(officerId);
    setToastMessage(null);

    try {
      await updateZonalAdminStatus(accessToken, officerId, newStatus);
      setToastMessage({
        type: "success",
        text: `Status for Zonal Admin "${adminName}" updated to ${newStatus}.`,
      });
      fetchDashboardData();
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to update admin status.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleZoneStatusChange = async (
    zoneId: number,
    newStatus: "ACTIVE" | "INACTIVE",
    zoneName: string,
  ) => {
    if (!accessToken) return;

    setUpdatingId(zoneId);
    setToastMessage(null);

    try {
      await updateZoneStatus(accessToken, zoneId, newStatus);
      setToastMessage({
        type: "success",
        text: `Status for Zone "${zoneName}" updated to ${newStatus}.`,
      });
      fetchDashboardData();
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to update zone status.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading && !dashboard) {
    return (
      <AppLayout title="Zonal Management" subtitle="Maharashtra State Operations">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900" />
            <p className="text-sm text-slate-500">Loading Zonal Management...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !dashboard) {
    return (
      <AppLayout title="Zonal Management" subtitle="Maharashtra State Operations">
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

  const filteredZones = dashboard.zones.filter((z: SuperAdminZoneDetail) => {
    const matchesSearch =
      !searchQuery ||
      z.zone_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      z.zone_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (z.zonal_admin?.officer_name ?? "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (z.zonal_admin?.email ?? "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "ACTIVE") {
      matchesStatus = z.zonal_admin ? z.zonal_admin.is_active !== false : false;
    } else if (statusFilter === "INACTIVE") {
      matchesStatus = z.zonal_admin ? z.zonal_admin.is_active === false : false;
    } else if (statusFilter === "UNASSIGNED") {
      matchesStatus = !z.zonal_admin;
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout
      title="Zonal Management"
      subtitle="Maharashtra State Zones & Assigned Zonal Administrators"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`mb-6 flex items-center justify-between rounded-xl p-4 text-xs font-semibold shadow-xs ${
            toastMessage.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        {/* Search */}
        <div className="flex flex-1 min-w-[260px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by Zone name, Code, Admin name, or Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[11px] mr-1">
            Status:
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              statusFilter === "ALL"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Zones ({dashboard.zones.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              statusFilter === "ACTIVE"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            🟢 Active Admins ({dashboard.zones.filter((z) => z.zonal_admin && z.zonal_admin.is_active !== false).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("INACTIVE")}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              statusFilter === "INACTIVE"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            🟡 Inactive ({dashboard.zones.filter((z) => z.zonal_admin && z.zonal_admin.is_active === false).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("UNASSIGNED")}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              statusFilter === "UNASSIGNED"
                ? "bg-slate-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            ⚪ Unassigned ({dashboard.zones.filter((z) => !z.zonal_admin).length})
          </button>

          <Link
            href="/admin/zonal-admin/create"
            className="flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-3.5 py-1.5 font-semibold text-white transition hover:bg-slate-800 ml-2"
          >
            <span>➕</span>
            <span>Create Admin</span>
          </Link>
        </div>
      </div>

      {/* Main Zonal Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 pl-6 pr-4">Zone</th>
                <th className="py-3.5 pr-4">Assigned Zonal Admin</th>
                <th className="py-3.5 pr-4 text-center">Master Meters</th>
                <th className="py-3.5 pr-4">Admin Status</th>
                <th className="py-3.5 pr-6 text-right">Actions / Update Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredZones.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <p className="text-2xl">🏢</p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      No zones found matching the filter criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredZones.map((zone) => {
                  const admin = zone.zonal_admin;
                  const isAdminActive = admin ? admin.is_active !== false : false;

                  return (
                    <tr
                      key={zone.id}
                      className="transition hover:bg-slate-50/80"
                    >
                      {/* 1. Zone Info */}
                      <td className="py-4 pl-6 pr-4">
                        <div className="font-bold text-sm text-slate-900">
                          {zone.zone_name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          Code: {zone.zone_code}
                        </div>
                      </td>

                      {/* 2. Assigned Zonal Admin */}
                      <td className="py-4 pr-4">
                        {admin ? (
                          <div>
                            <div className="font-semibold text-slate-900 text-xs">
                              {admin.officer_name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {admin.email} &bull; {admin.phone}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              Code: {admin.officer_code}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 border border-amber-200">
                            <span>⚠️</span> Unassigned
                          </span>
                        )}
                      </td>

                      {/* 3. Master Meters */}
                      <td className="py-4 pr-4 text-center">
                        <span className="inline-block rounded-lg bg-blue-50 px-3 py-1 font-mono text-xs font-bold text-blue-700 border border-blue-200">
                          {zone.master_meter_count}
                        </span>
                      </td>

                      {/* 4. Admin Status Badge */}
                      <td className="py-4 pr-4">
                        {admin ? (
                          isAdminActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Inactive
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* 6. Updateable Status Controls */}
                      <td className="py-4 pr-6 text-right">
                        {admin ? (
                          <div className="inline-flex items-center gap-2">
                            {/* Status Selector Dropdown */}
                            <select
                              value={isAdminActive ? "ACTIVE" : "INACTIVE"}
                              disabled={updatingId === admin.id}
                              onChange={(e) => {
                                const val = e.target.value as "ACTIVE" | "INACTIVE" | "DELETED";
                                if (val === "DELETED") {
                                  handleAdminStatusChange(admin.id, "DELETED", admin.officer_name);
                                } else {
                                  handleAdminStatusChange(admin.id, val, admin.officer_name);
                                }
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
                            >
                              <option value="ACTIVE">🟢 Set Active</option>
                              <option value="INACTIVE">🟡 Set Inactive</option>
                              <option value="DELETED">🔴 Delete / Unassign</option>
                            </select>

                            {/* Quick Delete/Unassign Button */}
                            <button
                              type="button"
                              onClick={() => handleAdminStatusChange(admin.id, "DELETED", admin.officer_name)}
                              disabled={updatingId === admin.id}
                              title="Unassign Admin from Zone"
                              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-xs text-red-600 hover:bg-red-100 transition"
                            >
                              🗑️
                            </button>
                          </div>
                        ) : (
                          <Link
                            href="/admin/zonal-admin/create"
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                          >
                            <span>➕ Assign Admin</span>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-xs text-slate-500">
          <span>
            Total: <strong>{filteredZones.length}</strong> zones displayed
          </span>
          <span className="text-[11px] text-slate-400">
            Changes to admin status take effect immediately.
          </span>
        </div>
      </div>
    </AppLayout>
  );
}
