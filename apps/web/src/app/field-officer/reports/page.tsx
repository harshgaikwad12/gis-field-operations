"use client";

import { useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  getFieldOfficerReports,
  type FieldOfficerReportResponse,
  type VisitLog,
} from "@/lib/api";

export default function FieldOfficerReportsPage() {
  return (
    <ProtectedRoute allowedRoles={["FIELD_OFFICER", "SUPER_ADMIN"]}>
      <FieldOfficerReportsContent />
    </ProtectedRoute>
  );
}

function FieldOfficerReportsContent() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<FieldOfficerReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchReports = () => {
    if (!accessToken) return;
    setLoading(true);
    getFieldOfficerReports(accessToken)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports();
  }, [accessToken]);

  if (loading && !data) {
    return (
      <AppLayout title="Performance Reports" subtitle="GIS Field Operations">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900" />
            <p className="text-sm text-slate-500">Loading performance reports...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !data) {
    return (
      <AppLayout title="Performance Reports" subtitle="GIS Field Operations">
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

  const filteredVisits = data.recent_visits.filter((v: VisitLog) => {
    const matchesSearch =
      !searchQuery ||
      v.consumer_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.meter_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.notes ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || v.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAYMENT_RECOVERED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Payment Recovered
          </span>
        );
      case "PAYMENT_NOT_RECOVERED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Not Recovered
          </span>
        );
      case "CONSUMER_CONTACTED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Consumer Contacted
          </span>
        );
      case "CONSUMER_UNAVAILABLE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Unavailable
          </span>
        );
      case "METER_PROBLEM_IDENTIFIED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            Meter Issue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <AppLayout
      title="Performance & Activity Reports"
      subtitle={`Scoped to: ${data.field_area_name} • Officer: ${data.officer_name} (${data.officer_code})`}
    >
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">Field Operations Reporting</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Field Officer Performance Report
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time field visit log, consumer recovery status, and ward efficiency metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchReports}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <span>🔄</span>
            <span>Refresh Report</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800"
          >
            <span>🖨️</span>
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* METRIC CARDS (Phase 21) */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: VISITED VS UNVISITED */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Consumers Visited</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data.total_visited_consumers}{" "}
            <span className="text-sm font-normal text-slate-400">
              / {data.total_assigned_consumers}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {data.total_unvisited_consumers} unvisited consumers remaining
          </p>
        </div>

        {/* CARD 2: RECOVERED AMOUNT */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Total Recovered</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            ₹{data.total_recovered_amount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-400">Total payment collected</p>
        </div>

        {/* CARD 3: OUTSTANDING BALANCE */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Outstanding Balance</p>
          <p className="mt-2 text-2xl font-bold text-red-600">
            ₹{data.total_outstanding_amount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-400">Pending recovery in ward</p>
        </div>

        {/* CARD 4: RECOVERY RATE */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Recovery Rate</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {data.recovery_rate_percentage}%
          </p>
          <p className="mt-1 text-xs text-slate-400">Collection efficiency</p>
        </div>
      </div>

      {/* STATUS BREAKDOWN CARDS */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Field Visit Outcome Breakdown</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-center">
            <p className="text-xl font-bold text-emerald-700">
              {data.status_breakdown.find((s) => s.status === "PAYMENT_RECOVERED")?.count ?? 0}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-emerald-800">Payment Recovered</p>
          </div>

          <div className="rounded-xl border border-red-100 bg-red-50/60 p-3 text-center">
            <p className="text-xl font-bold text-red-700">
              {data.status_breakdown.find((s) => s.status === "PAYMENT_NOT_RECOVERED")?.count ?? 0}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-red-800">Not Recovered</p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-center">
            <p className="text-xl font-bold text-blue-700">
              {data.status_breakdown.find((s) => s.status === "CONSUMER_CONTACTED")?.count ?? 0}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-blue-800">Contacted</p>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-center">
            <p className="text-xl font-bold text-amber-700">
              {data.status_breakdown.find((s) => s.status === "CONSUMER_UNAVAILABLE")?.count ?? 0}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-amber-800">Unavailable</p>
          </div>

          <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3 text-center">
            <p className="text-xl font-bold text-purple-700">
              {data.status_breakdown.find((s) => s.status === "METER_PROBLEM_IDENTIFIED")?.count ?? 0}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-purple-800">Meter Issue</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-xl font-bold text-slate-700">
              {data.status_breakdown.find((s) => s.status === "OTHER")?.count ?? 0}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-800">Other / Followup</p>
          </div>
        </div>
      </div>

      {/* FIELD VISIT ACTIVITY LOGS TABLE */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        {/* Search & Filter */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Field Visit History ({filteredVisits.length})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Chronological log of visits performed in {data.field_area_name}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <input
              type="text"
              placeholder="Search Consumer ID, Meter, Notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:bg-white"
            />

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAYMENT_RECOVERED">Payment Recovered</option>
              <option value="PAYMENT_NOT_RECOVERED">Payment Not Recovered</option>
              <option value="CONSUMER_CONTACTED">Consumer Contacted</option>
              <option value="CONSUMER_UNAVAILABLE">Consumer Unavailable</option>
              <option value="METER_PROBLEM_IDENTIFIED">Meter Problem</option>
            </select>
          </div>
        </div>

        {filteredVisits.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <span className="text-3xl">📋</span>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              No field visit records found matching filter.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Record visits from the Field Dashboard to populate this report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 pl-4 pr-3">Date &amp; Time</th>
                  <th className="py-3 pr-3">Consumer ID</th>
                  <th className="py-3 pr-3">Meter ID</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-3">Amount Collected</th>
                  <th className="py-3 pr-3">Officer Remarks</th>
                  <th className="py-3 pr-4 text-right">GPS Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVisits.map((v) => {
                  const visitDate = new Date(v.created_at);
                  return (
                    <tr key={v.id} className="transition hover:bg-slate-50/80">
                      <td className="py-3.5 pl-4 pr-3 font-medium text-slate-600">
                        {visitDate.toLocaleDateString()} &bull;{" "}
                        <span className="text-slate-400">
                          {visitDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="py-3.5 pr-3 font-mono font-bold text-slate-900">
                        {v.consumer_id}
                      </td>
                      <td className="py-3.5 pr-3 font-mono text-slate-600">
                        {v.meter_id}
                      </td>
                      <td className="py-3.5 pr-3">
                        {getStatusBadge(v.status)}
                      </td>
                      <td className="py-3.5 pr-3 font-bold">
                        {v.amount_collected > 0 ? (
                          <span className="text-emerald-600">
                            ₹{v.amount_collected.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-3 text-slate-600 max-w-[220px] truncate">
                        {v.notes ?? "—"}
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-[11px] text-slate-400">
                        {v.latitude && v.longitude
                          ? `${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
