"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  getFieldOfficerDashboard,
  uploadFieldOfficerPendingConsumers,
  type FieldOfficerDashboardResponse,
  type UploadPendingConsumerResult,
} from "@/lib/api";

export default function FieldOfficerDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["FIELD_OFFICER", "SUPER_ADMIN"]}>
      <FieldOfficerDashboardContent />
    </ProtectedRoute>
  );
}

function FieldOfficerDashboardContent() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<FieldOfficerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchDashboard = () => {
    if (!accessToken) return;

    setLoading(true);
    getFieldOfficerDashboard(accessToken)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, [accessToken]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadMessage(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile || !accessToken) return;

    setUploading(true);
    setUploadMessage(null);

    try {
      const res: UploadPendingConsumerResult =
        await uploadFieldOfficerPendingConsumers(accessToken, selectedFile);
      setUploadMessage({
        type: "success",
        text: `Successfully imported ${res.inserted} new consumers (${res.updated} updated) from "${res.filename}".`,
      });
      setSelectedFile(null);
      fetchDashboard();
    } catch (err: any) {
      setUploadMessage({
        type: "error",
        text: err.message || "Failed to upload pending consumer file.",
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading && !data) {
    return (
      <AppLayout title="Field Dashboard" subtitle="GIS Field Operations Management">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900" />
            <p className="text-sm text-slate-500">Loading operations dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !data) {
    return (
      <AppLayout title="Field Dashboard" subtitle="GIS Field Operations Management">
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

  const overdue30Count = (data.consumers || []).filter(
    (c) => (c.days_pending ?? 0) >= 30,
  ).length;

  return (
    <AppLayout
      title="Field Dashboard"
      subtitle={`Assigned Scope: ${data.zone_name} / ${data.area_name} / ${data.field_area_name}`}
    >
      {/* SECTION HEADER & QUICK LINKS */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Field Officer Workspace
          </p>
          <h1 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
            {data.officer_name} &bull; {data.field_area_name}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Officer Code: <strong>{data.officer_code}</strong> &bull; Ward Code: <strong>{data.field_area_code}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/field-officer/map"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            <span>🗺️</span>
            <span>GIS Ward Map & Route</span>
          </Link>

          <Link
            href="/field-officer/reports"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-100"
          >
            <span>📈</span>
            <span>Performance Reports</span>
          </Link>
        </div>
      </div>

      {/* KPI METRICS ROW */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Ward</p>
          <p className="mt-2 truncate text-xl font-bold text-slate-900">
            {data.field_area_name}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Code: {data.field_area_code}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Master Meters</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">
            {data.summary.assigned_meters}
          </p>
          <p className="mt-1 text-xs text-slate-400">In assigned ward</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Consumers</p>
          <p className="mt-2 text-3xl font-extrabold text-blue-600">
            {data.summary.assigned_consumers}
          </p>
          <p className="mt-1 text-xs text-slate-400">Awaiting recovery</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overdue &gt;30 Days</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-600">
            {overdue30Count}
          </p>
          <p className="mt-1 text-xs text-slate-400">High priority recovery</p>
        </div>
      </div>

      {/* UPLOAD PENDING CONSUMER FILE CARD */}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600">
            📥
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Upload Pending Consumer File
            </h2>
            <p className="text-xs text-slate-500">
              Upload CSV or XLSX file containing pending recovery accounts (<code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">consumer_id, consumer_name, meter_id, pending_amount, days_pending</code>).
            </p>
          </div>
        </div>

        <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-4">
          <input
            type="file"
            accept=".csv, .xlsx"
            onChange={handleFileChange}
            disabled={uploading}
            className="text-xs text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 transition"
          />

          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50"
          >
            <span>{uploading ? "⏳" : "⬆️"}</span>
            <span>{uploading ? "Importing Consumers..." : "Upload Pending File"}</span>
          </button>
        </form>

        {uploadMessage && (
          <div
            className={`mt-4 rounded-xl p-4 text-xs font-semibold shadow-xs ${
              uploadMessage.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {uploadMessage.text}
          </div>
        )}
      </section>

      {/* QUICK WORKSPACE NAVIGATION TILES */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/field-officer/map"
          className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-slate-300 hover:shadow-md"
        >
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl text-blue-600">
              🗺️
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
              GIS Ward Map & Route Navigation
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Explore live interactive map of {data.field_area_name}, solve optimal shortest routes across pending meters, view nearby consumers, and record on-site field visits.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1 text-xs font-bold text-blue-600">
            <span>Open Spatial Map & Routing</span>
            <span className="transition group-hover:translate-x-1">&rarr;</span>
          </div>
        </Link>

        <Link
          href="/field-officer/reports"
          className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-slate-300 hover:shadow-md"
        >
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl text-emerald-600">
              📈
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-emerald-600 transition">
              Performance & Visit Reports
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Analyze payment recovery rate percentages, review completed and pending consumer visits, and inspect chronological field logs.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1 text-xs font-bold text-emerald-600">
            <span>View Performance Reports</span>
            <span className="transition group-hover:translate-x-1">&rarr;</span>
          </div>
        </Link>
      </section>
    </AppLayout>
  );
}
