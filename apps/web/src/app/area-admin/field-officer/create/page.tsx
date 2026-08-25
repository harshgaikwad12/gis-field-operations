"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  createFieldOfficer,
  getAreaAdminFieldAreas,
  type AreaAdminFieldAreaResponse,
} from "@/lib/api";

function CreateFieldOfficerForm() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [officerCode, setOfficerCode] = useState("");
  const [officerName, setOfficerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [selectedFieldAreaId, setSelectedFieldAreaId] = useState("");

  const [fieldAreas, setFieldAreas] = useState<AreaAdminFieldAreaResponse[]>([]);
  const [fieldAreasLoading, setFieldAreasLoading] = useState(true);
  const [fieldAreasError, setFieldAreasError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let cancelled = false;

    async function loadFieldAreas(token: string) {
      try {
        setFieldAreasError("");
        const data = await getAreaAdminFieldAreas(token);
        if (!cancelled) {
          setFieldAreas(data);
          if (data.length > 0) {
            setSelectedFieldAreaId(String(data[0].id));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setFieldAreasError(
            err instanceof Error
              ? err.message
              : "Unable to load active field areas.",
          );
        }
      } finally {
        if (!cancelled) {
          setFieldAreasLoading(false);
        }
      }
    }

    void loadFieldAreas(accessToken);

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setSuccess("");

    if (!accessToken) {
      setError("Authentication session is unavailable.");
      return;
    }

    const cleanedPhone = phone.trim();
    if (!/^\d{10}$/.test(cleanedPhone)) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }

    const numericFieldAreaId = Number(selectedFieldAreaId);
    if (!Number.isInteger(numericFieldAreaId) || numericFieldAreaId <= 0) {
      setError("Please select a valid field area.");
      return;
    }

    setLoading(true);

    try {
      const created = await createFieldOfficer(accessToken, {
        officer_code: officerCode.trim(),
        officer_name: officerName.trim(),
        email: email.trim(),
        phone: cleanedPhone,
        password,
        field_area_id: numericFieldAreaId,
        is_active: true,
      });

      setSuccess(`Field Officer "${created.officer_name}" created successfully.`);
      setOfficerCode("");
      setOfficerName("");
      setEmail("");
      setPhone("");
      setPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create field officer.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout
      title="Create Field Officer"
      subtitle="Provision credentials and assign a field area"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
            Field Officer Details
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Create a field technician and assign them to an active field area ward.
          </p>
        </div>

        {/* SUCCESS */}
        {success && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3"
          >
            <p className="text-sm font-medium text-green-700">{success}</p>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
          >
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        {/* FIELD AREAS LOADING ERROR */}
        {fieldAreasError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <p className="text-sm font-medium text-amber-700">{fieldAreasError}</p>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Code */}
            <div>
              <label
                htmlFor="officer-code"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Officer Code
              </label>
              <input
                id="officer-code"
                name="officer_code"
                type="text"
                required
                value={officerCode}
                onChange={(e) => setOfficerCode(e.target.value)}
                placeholder="FO001"
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="officer-name"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Officer Name
              </label>
              <input
                id="officer-name"
                name="officer_name"
                type="text"
                required
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder="Enter officer name"
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@example.com"
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="9876543210"
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Must be exactly 10 digits.
              </p>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Minimum 6 characters.
              </p>
            </div>

            {/* Field Area dropdown */}
            <div>
              <label
                htmlFor="field-area-id"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Assigned Field Area
              </label>
              <select
                id="field-area-id"
                name="field_area_id"
                required
                value={selectedFieldAreaId}
                onChange={(e) => setSelectedFieldAreaId(e.target.value)}
                disabled={fieldAreasLoading || fieldAreas.length === 0}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100 disabled:opacity-60"
              >
                {fieldAreasLoading ? (
                  <option value="">Loading field areas...</option>
                ) : fieldAreas.length === 0 ? (
                  <option value="">No active field areas found in your Area</option>
                ) : (
                  fieldAreas.map((fa) => (
                    <option key={fa.id} value={fa.id}>
                      {fa.field_area_name} ({fa.field_area_code})
                    </option>
                  ))
                )}
              </select>
              <p className="mt-1.5 text-xs text-slate-400">
                Select from the active wards/sectors inside your Area boundary.
              </p>
            </div>
          </div>

          {/* Role Info */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Role Permission Boundary
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">FIELD_OFFICER</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Field Officers are limited to field operations, meter status verification, and customer matching inside their assigned field area.
            </p>
          </div>

          {/* Form action buttons */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="min-h-11 rounded-lg border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || fieldAreasLoading || fieldAreas.length === 0}
              className="min-h-11 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create Field Officer"}
            </button>
          </div>
        </form>
      </section>
    </AppLayout>
  );
}

export default function CreateFieldOfficerPage() {
  return (
    <ProtectedRoute allowedRoles={["AREA_ADMIN"]}>
      <CreateFieldOfficerForm />
    </ProtectedRoute>
  );
}
