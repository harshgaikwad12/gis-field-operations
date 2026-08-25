"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getCurrentOfficer,
  isOfficerRole,
  login as apiLogin,
  type CurrentOfficer,
  type OfficerRole,
} from "@/lib/api";

const ACCESS_TOKEN_KEY = "access_token";

interface AuthContextValue {
  officer: CurrentOfficer | null;
  accessToken: string | null;
  officerRole: OfficerRole | null;
  isAdmin: boolean;
  isAreaAdmin: boolean;
  isFieldOfficer: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<CurrentOfficer>;
  refreshAuth: () => Promise<CurrentOfficer | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearStoredToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function storeToken(token: string): void {
  if (typeof window === "undefined") {
    throw new Error("Authentication storage is unavailable.");
  }

  try {
    sessionStorage.setItem(
      ACCESS_TOKEN_KEY,
      token,
    );
  } catch {
    throw new Error(
      "Unable to store authentication session.",
    );
  }
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [officer, setOfficer] =
    useState<CurrentOfficer | null>(null);

  const [accessToken, setAccessToken] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const logout = useCallback(() => {
    clearStoredToken();

    setAccessToken(null);
    setOfficer(null);
  }, []);

  const refreshAuth = useCallback(
    async (): Promise<CurrentOfficer | null> => {
      const token = getStoredToken();

      if (!token) {
        setAccessToken(null);
        setOfficer(null);
        return null;
      }

      setAccessToken(token);

      try {
        const currentOfficer =
          await getCurrentOfficer(token);

        if (!isOfficerRole(currentOfficer.role)) {
          throw new Error(
            "Authenticated officer has an invalid role.",
          );
        }

        setOfficer(currentOfficer);

        return currentOfficer;
      } catch {
        clearStoredToken();

        setAccessToken(null);
        setOfficer(null);

        return null;
      }
    },
    [],
  );

  const login = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<CurrentOfficer> => {
      const result = await apiLogin(
        email.trim(),
        password,
      );

      storeToken(result.access_token);
      setAccessToken(result.access_token);

      try {
        const currentOfficer =
          await getCurrentOfficer(
            result.access_token,
          );

        if (!isOfficerRole(currentOfficer.role)) {
          throw new Error(
            "Authenticated officer has an invalid role.",
          );
        }

        setOfficer(currentOfficer);

        return currentOfficer;
      } catch (error) {
        clearStoredToken();

        setAccessToken(null);
        setOfficer(null);

        throw error;
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const currentOfficer =
          await refreshAuth();

        if (!mounted) {
          return;
        }

        setOfficer(currentOfficer);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void initializeAuth();

    return () => {
      mounted = false;
    };
  }, [refreshAuth]);

  const officerRole =
    officer?.role ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      officer,
      accessToken,
      officerRole,
      isAdmin: officerRole === "ADMIN",
      isAreaAdmin: officerRole === "AREA_ADMIN",
      isFieldOfficer:
        officerRole === "FIELD_OFFICER",
      isAuthenticated: officer !== null,
      isLoading,
      login,
      refreshAuth,
      logout,
    }),
    [
      officer,
      accessToken,
      officerRole,
      isLoading,
      login,
      refreshAuth,
      logout,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}
