"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { uploadMasterData } from "@/lib/api";

function MasterDataUploadPage() {
  const { accessToken, isLoading: authLoading } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragActive, setDragActive] = useState(false);

  function validateFile(file: File): string | null {
    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx")) {
      return "Only CSV and XLSX files are supported.";
    }

    if (file.size === 0) {
      return "The selected file is empty.";
    }

    return null;
  }

  function selectFile(file: File | null) {
    setError("");
    setSuccess("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateFile(file);

    if (validationError) {
      setSelectedFile(null);
      setError(validationError);
      return;
    }

    setSelectedFile(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    selectFile(file);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    selectFile(file);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedFile) {
      setError("Please select a CSV or XLSX file.");
      return;
    }

    if (!accessToken) {
      setError("Authentication token is not available.");
      return;
    }

    setUploading(true);

    try {
      const result = await uploadMasterData(accessToken, selectedFile);

      setSuccess(
        `${result.message} ${result.inserted} records inserted and ${result.updated} records updated.`,
      );

      setSelectedFile(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload master data.",
      );
    } finally {
      setUploading(false);
    }
  }

  function clearFile() {
    setSelectedFile(null);
    setError("");
    setSuccess("");
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-500">Checking authentication...</p>
      </main>
    );
  }

  return (
    <AppLayout
      title="Upload Master Data"
      subtitle="Import master meter records using CSV or XLSX"
    >
      {/* ERROR MESSAGE */}
      {error && (
        <section className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="whitespace-pre-line text-sm font-medium text-red-700">
            {error}
          </p>
        </section>
      )}

      {/* SUCCESS MESSAGE */}
      {success && (
        <section className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm font-medium text-green-700">{success}</p>
        </section>
      )}

      {/* UPLOAD SECTION */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
            Master Meter Data Upload
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload a CSV or XLSX file containing master meter records.
          </p>
        </div>

        <form onSubmit={handleUpload} className="mt-6">
          {/* DROP ZONE */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={[
              "rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-12",
              dragActive
                ? "border-slate-900 bg-slate-100"
                : "border-slate-300 bg-slate-50",
            ].join(" ")}
          >
            <div className="mx-auto max-w-lg">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-7 w-7 text-slate-600"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16V4m0 0-4 4m4-4 4 4"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
                  />
                </svg>
              </div>

              <h3 className="mt-5 text-base font-semibold text-slate-900">
                Select your master data file
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Drag and drop your file here, or select a file from your computer.
              </p>

              <div className="mt-5">
                <label
                  htmlFor="master-data-file"
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Choose File
                </label>

                <input
                  id="master-data-file"
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </div>

              <p className="mt-4 text-xs text-slate-400">
                Supported formats: CSV, XLSX
              </p>
            </div>
          </div>

          {/* SELECTED FILE */}
          {selectedFile && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Selected File
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {selectedFile.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearFile}
                  disabled={uploading}
                  className="w-fit rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* UPLOAD BUTTON */}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => history.back()}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Uploading...
                </>
              ) : (
                "Upload Master Data"
              )}
            </button>
          </div>
        </form>
      </section>

      {/* REQUIRED FILE FORMAT */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Required File Format
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Your uploaded file must contain the following columns.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[600px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 font-semibold">Column</th>
                <th className="px-3 py-3 font-semibold">Required</th>
                <th className="px-3 py-3 font-semibold">Description</th>
              </tr>
            </thead>

            <tbody>
              <RequiredColumn
                name="meter_id"
                description="Unique meter identifier"
              />
              <RequiredColumn
                name="customer_id"
                description="Customer identifier"
              />
              <RequiredColumn
                name="customer_name"
                description="Customer name"
              />
              <RequiredColumn
                name="latitude"
                description="Meter latitude (-90 to 90)"
              />
              <RequiredColumn
                name="longitude"
                description="Meter longitude (-180 to 180)"
              />
            </tbody>
          </table>
        </div>

        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">Validation</p>
          <p className="mt-1 text-xs leading-5 text-blue-700">
            The system validates the uploaded file before importing any records. If validation fails, no records are imported.
          </p>
        </div>
      </section>
    </AppLayout>
  );
}

function RequiredColumn({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-3 py-3">
        <code className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">
          {name}
        </code>
      </td>
      <td className="px-3 py-3">
        <span className="font-medium text-slate-700">Yes</span>
      </td>
      <td className="px-3 py-3 text-slate-600">{description}</td>
    </tr>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MasterDataPage() {
  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <MasterDataUploadPage />
    </ProtectedRoute>
  );
}