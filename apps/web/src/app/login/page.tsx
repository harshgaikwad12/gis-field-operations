"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import type { OfficerRole } from "@/lib/api";

function getDashboardPath(
  role: OfficerRole | null,
): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin";

    case "ADMIN":
      return "/admin";

    case "AREA_ADMIN":
      return "/area-admin";

    case "FIELD_OFFICER":
      return "/field-officer";

    default:
      return "/login";
  }
}

export default function LoginPage() {
  const router = useRouter();

  const {
    login,
    officer,
    isAuthenticated,
    isLoading,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /*
   * If the user is already authenticated and visits
   * /login, send them directly to their dashboard.
   */
  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated &&
      officer?.role
    ) {
      router.replace(
        getDashboardPath(officer.role),
      );
    }
  }, [
    isAuthenticated,
    isLoading,
    officer,
    router,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      /*
       * AuthContext:
       * 1. Calls backend login
       * 2. Stores JWT
       * 3. Calls /auth/me
       * 4. Gets authenticated officer
       * 5. Returns CurrentOfficer
       */
      const currentOfficer = await login(
        email.trim(),
        password,
      );

      /*
       * Redirect according to the authenticated
       * officer's actual backend role.
       */
      router.replace(
        getDashboardPath(
          currentOfficer.role,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-500">
          Checking authentication...
        </p>
      </main>
    );
  }

  /*
   * While an already-authenticated user is being
   * redirected, don't render the login form again.
   */
  if (
    isAuthenticated &&
    officer?.role
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-500">
          Redirecting to your dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:px-6">
      <section className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-bold text-white">
            GIS
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            GIS Field Operations
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Sign in to continue to the operations portal.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Sign in
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Use your officer credentials.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email or Officer Code
              </label>

              <input
                id="email"
                name="email"
                type="text"
                autoComplete="username"
                required
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                placeholder="officer@example.com or officer code"
              />
            </div>

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
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="min-h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Signing in..."
                : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          GIS Field Operations Management Portal
        </p>
      </section>
    </main>
  );
}