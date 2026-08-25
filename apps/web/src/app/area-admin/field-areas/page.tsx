"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  getAreaAdminDashboard,
  updateFieldOfficerStatus,
  type AreaAdminDashboardResponse,
  type AreaAdminFieldAreaDetail,
} from "@/lib/api";

export default function FieldAreaManagementPage() {
  return (
    <ProtectedRoute allowedRoles={["AREA_ADMIN", "SUPER_ADMIN"]}>
      <FieldAreaManagementContent />
    </ProtectedRoute>
  );
}

function FieldAreaManagementContent() {
  const { accessToken } = useAuth();
  const [dashboard, setDashboard] =
    useState<AreaAdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE" | "UNASSIGNED"
  >("ALL");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchDashboardData = () => {
    if (!accessToken) return;
    setLoading(true);
    getAreaAdminDashboard(accessToken)
      .then(setDashboard)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();
  }, [accessToken]);

  const handleOfficerStatusChange = async (
    officerId: number,
    newStatus: "ACTIVE" | "INACTIVE" | "DELETED",
    officerName: string,
  ) => {
    if (!accessToken) return;

    if (
      newStatus === "DELETED" &&
      !window.confirm(
        `Are you sure you want to unassign/remove Field Officer "${officerName}"?`,
      )
    ) {
      return;
    }

    setUpdatingId(officerId);
    setToastMessage(null);

    try {
      await updateFieldOfficerStatus(accessToken, officerId, newStatus);
      setToastMessage({
        type: "success",
        text: `Status for Field Officer "${officerName}" updated to ${newStatus}.`,
      });
      fetchDashboardData();
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err.message || "Failed to update officer status.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading && !dashboard) {
    return (
      <AppLayout
        title="Field Area Management"
        subtitle="Loading operational wards..."
      >
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900" />
            <p className="text-sm text-slate-500">Loading field areas...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !dashboard) {
    return (
      <AppLayout
        title="Field Area Management"
        subtitle="Area Operations Portal"
      >
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

  const fieldAreas = dashboard.field_areas || [];

  // Filter items
  const filteredAreas = fieldAreas.filter((fa: AreaAdminFieldAreaDetail) => {
    const matchesSearch =
      !searchQuery ||
      fa.field_area_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fa.field_area_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (fa.assigned_officer?.officer_name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (fa.assigned_officer?.email || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (fa.assigned_officer?.officer_code || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "ACTIVE") {
      matchesStatus = fa.assigned_officer ? true : false;
    } else if (statusFilter === "INACTIVE") {
      matchesStatus = fa.assigned_officer ? false : false;
    } else if (statusFilter === "UNASSIGNED") {
      matchesStatus = !fa.assigned_officer;
    }

    return matchesSearch && matchesStatus;
  });

  const activeOfficersCount = fieldAreas.filter(
    (fa) => !!fa.assigned_officer,
  ).length;
  const unassignedCount = fieldAreas.filter(
    (fa) => !fa.assigned_officer,
  ).length;

  return (
    <AppLayout
      title="Field Area Management"
      subtitle={`${dashboard.area_name} (${dashboard.area_code}) Wards & Assigned Field Officers`}
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
          <span className="text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Search ward name, code, officer name, email..."
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
            All Wards ({fieldAreas.length})
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
            🟢 Active Officers ({activeOfficersCount})
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
            ⚪ Unassigned ({unassignedCount})
          </button>

          <Link
            href="/area-admin/field-officer/create"
            className="flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-3.5 py-1.5 font-semibold text-white transition hover:bg-slate-800 ml-2"
          >
            <span>➕</span>
            <span>Create Field Officer</span>
          </Link>
        </div>
      </div>

      {/* Main Field Areas Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 pl-6 pr-4">Field Area (Ward)</th>
                <th className="py-3.5 pr-4">Assigned Field Officer</th>
                <th className="py-3.5 pr-4">Officer Status</th>
                <th className="py-3.5 pr-6 text-right">
                  Actions / Update Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAreas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <p className="text-2xl">🏢</p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      No field areas found matching the filter criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAreas.map((fa: AreaAdminFieldAreaDetail) => {
                  const officer = fa.assigned_officer;

                  return (
                    <tr key={fa.id} className="transition hover:bg-slate-50/80">
                      {/* 1. Field Area (Ward) Info */}
                      <td className="py-4 pl-6 pr-4">
                        <div className="font-bold text-sm text-slate-900">
                          {fa.field_area_name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          Code: {fa.field_area_code}
                        </div>
                      </td>

                      {/* 2. Assigned Field Officer */}
                      <td className="py-4 pr-4">
                        {officer ? (
                          <div>
                            <div className="font-semibold text-slate-900 text-xs">
                              {officer.officer_name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {officer.email} &bull; {officer.phone}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              Code: {officer.officer_code}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 border border-amber-200">
                            <span>⚠️</span> Unassigned
                          </span>
                        )}
                      </td>

                      {/* 3. Officer Status Badge */}
                      <td className="py-4 pr-4">
                        {officer ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* 5. Updateable Status Controls */}
                      <td className="py-4 pr-6 text-right">
                        {officer ? (
                          <div className="inline-flex items-center gap-2">
                            {/* Status Selector Dropdown */}
                            <select
                              defaultValue="ACTIVE"
                              disabled={updatingId === officer.id}
                              onChange={(e) => {
                                const val = e.target.value as
                                  | "ACTIVE"
                                  | "INACTIVE"
                                  | "DELETED";
                                handleOfficerStatusChange(
                                  officer.id,
                                  val,
                                  officer.officer_name,
                                );
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
                            >
                              <option value="ACTIVE">🟢 Set Active</option>
                              <option value="INACTIVE">🟡 Set Inactive</option>
                              <option value="DELETED">
                                🔴 Delete / Unassign
                              </option>
                            </select>

                            {/* Quick Delete/Unassign Button */}
                            <button
                              type="button"
                              onClick={() =>
                                handleOfficerStatusChange(
                                  officer.id,
                                  "DELETED",
                                  officer.officer_name,
                                )
                              }
                              disabled={updatingId === officer.id}
                              title="Unassign Officer from Ward"
                              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-xs text-red-600 hover:bg-red-100 transition"
                            >
                              🗑️
                            </button>
                          </div>
                        ) : (
                          <Link
                            href="/area-admin/field-officer/create"
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                          >
                            <span>➕ Assign Officer</span>
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
            Total: <strong>{filteredAreas.length}</strong> field areas displayed
          </span>
          <span>
            Assigned Field Officers: <strong>{activeOfficersCount}</strong>
          </span>
        </div>
      </div>
    </AppLayout>
  );
}
