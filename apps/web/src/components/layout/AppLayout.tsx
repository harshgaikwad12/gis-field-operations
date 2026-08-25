"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  fullWidth?: boolean;
}

export function AppLayout({ children, title, subtitle, fullWidth = false }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { officer, officerRole, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSuperAdmin = officerRole === "SUPER_ADMIN";
  const isAreaAdmin = officerRole === "AREA_ADMIN";
  const isFieldOfficer = officerRole === "FIELD_OFFICER";

  let dashboardHref = "/admin";
  if (isSuperAdmin) {
    dashboardHref = "/super-admin";
  } else if (isAreaAdmin) {
    dashboardHref = "/area-admin";
  } else if (isFieldOfficer) {
    dashboardHref = "/field-officer";
  }

  const navigation = isFieldOfficer
    ? [
        {
          label: "Field Dashboard",
          href: "/field-officer",
          icon: "📊",
          active: pathname === "/field-officer",
        },
        {
          label: "GIS Ward Map",
          href: "/field-officer/map",
          icon: "🗺️",
          active: pathname === "/field-officer/map",
        },
        {
          label: "Performance Reports",
          href: "/field-officer/reports",
          icon: "📈",
          active: pathname === "/field-officer/reports",
        },
      ]
    : isAreaAdmin
    ? [
        {
          label: "Dashboard",
          href: "/area-admin",
          icon: "📊",
          active: pathname === "/area-admin",
        },
        {
          label: "GIS Area Map",
          href: "/area-admin/map",
          icon: "🗺️",
          active: pathname === "/area-admin/map",
        },
        {
          label: "Field Area Management",
          href: "/area-admin/field-areas",
          icon: "🏢",
          active: pathname === "/area-admin/field-areas",
        },
        {
          label: "Create Field Officer",
          href: "/area-admin/field-officer/create",
          icon: "👤",
          active: pathname === "/area-admin/field-officer/create",
        },
      ]
    : isSuperAdmin
    ? [
        {
          label: "Dashboard",
          href: dashboardHref,
          icon: "📊",
          active: pathname === "/super-admin",
        },
        {
          label: "GIS State Map",
          href: "/super-admin/map",
          icon: "🗺️",
          active: pathname === "/super-admin/map",
        },
        {
          label: "Zonal Management",
          href: "/super-admin/zones",
          icon: "🏢",
          active: pathname === "/super-admin/zones",
        },
        {
          label: "Create Zonal Admin",
          href: "/admin/zonal-admin/create",
          icon: "👤",
          active: pathname === "/admin/zonal-admin/create",
        },
      ]
    : [
        {
          label: "Dashboard",
          href: dashboardHref,
          icon: "📊",
          active: pathname === "/admin",
        },
        {
          label: "GIS Zone Map",
          href: "/admin/map",
          icon: "🗺️",
          active: pathname === "/admin/map",
        },
        {
          label: "Create Area Admin",
          href: "/admin/area-admin/create",
          icon: "👤",
          active: pathname === "/admin/area-admin/create",
        },
        {
          label: "Upload Master Data",
          href: "/admin/master-data",
          icon: "📤",
          active:
            pathname === "/admin/master-data" ||
            pathname === "/admin/master-data/upload",
        },
      ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* =====================================================
          DESKTOP SIDEBAR
      ===================================================== */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        {/* Brand */}
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900">
              GIS Field Operations
            </p>
            <p className="text-xs text-slate-500">
              {isSuperAdmin
                ? "Maharashtra Portal"
                : isFieldOfficer
                ? "Field Operations Portal"
                : isAreaAdmin
                ? "Area Admin Portal"
                : "Zonal Admin Portal"}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {navigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3.5 text-left text-sm font-medium transition ${
                item.active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="flex w-5 justify-center text-base">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer / System status & Logout */}
        <div className="space-y-3 border-t border-slate-200 p-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Role & Status
            </p>
            <p className="mt-1 text-xs font-bold text-slate-800">
              {officerRole ?? "ADMIN"}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-600">Backend Connected</span>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-red-50 hover:text-red-700"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* =====================================================
          MOBILE BACKDROP & SIDEBAR
      ===================================================== */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform duration-200 lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900">
              GIS Field Operations
            </p>
            <p className="text-xs text-slate-500">Operations Portal</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {navigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3.5 text-left text-sm font-medium ${
                item.active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="flex w-5 justify-center text-base">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
          <button
            type="button"
            onClick={logout}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-red-50 hover:text-red-700"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN CONTENT CONTAINER
      ===================================================== */}
      <div className="min-h-screen lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-xl text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              ☰
            </button>

            <div>
              <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
                {title ?? "Dashboard"}
              </h1>
              {subtitle && (
                <p className="hidden text-xs text-slate-500 sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">
                {officer?.officer_name ?? "Administrator"}
              </p>
              <p className="text-xs text-slate-500">
                Code: {officer?.officer_code ?? "—"}
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {officer?.officer_name
                ? officer.officer_name.slice(0, 2).toUpperCase()
                : "AD"}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div
          className={
            fullWidth
              ? "h-[calc(100vh-64px)] w-full p-2.5 flex flex-col overflow-hidden"
              : "mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
