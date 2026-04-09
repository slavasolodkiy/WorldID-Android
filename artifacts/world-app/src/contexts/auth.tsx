/**
 * AuthContext — session-aware auth state for the World App.
 *
 * Resolution:
 *   1. On mount, calls GET /api/auth/me to check if a session exists.
 *   2. If userId is non-null  → user is authenticated, show app.
 *   3. If userId is null      → user is unauthenticated, show login.
 *   4. On global `auth:unauthorized` event → resets to unauthenticated.
 *
 * Components anywhere in the tree can call `useAuth()` to get the
 * current session and the `signOut` helper.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useLogout,
  getGetMeQueryKey,
  type AuthSession,
} from "@workspace/api-client-react";

// ─── Context shape ────────────────────────────────────────────────────────────

export interface AuthState {
  /** null while loading, AuthSession once resolved */
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  /** Call after a successful login to refresh the session */
  refreshSession: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isUnauthenticated, setIsUnauthenticated] = useState(false);

  const {
    data: session,
    isLoading,
    refetch,
  } = useGetMe({
    query: {
      retry: false,
      refetchOnWindowFocus: false,
      // Don't throw on 401 — we handle it manually
      throwOnError: false,
    },
  });

  const logoutMutation = useLogout();

  // Listen for global 401 events emitted by customFetch
  useEffect(() => {
    const handler = () => {
      setIsUnauthenticated(true);
      queryClient.clear();
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [queryClient]);

  // When me returns userId=null, mark unauthenticated
  useEffect(() => {
    if (!isLoading && session && session.userId === null) {
      setIsUnauthenticated(true);
    } else if (!isLoading && session && session.userId !== null) {
      setIsUnauthenticated(false);
    }
  }, [isLoading, session]);

  const signOut = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      setIsUnauthenticated(true);
      queryClient.clear();
    }
  }, [logoutMutation, queryClient]);

  const refreshSession = useCallback(() => {
    setIsUnauthenticated(false);
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    refetch();
  }, [queryClient, refetch]);

  const isAuthenticated =
    !isUnauthenticated && !isLoading && (session?.userId ?? null) !== null;

  return (
    <AuthContext.Provider
      value={{ session: session ?? null, isLoading, isAuthenticated, signOut, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
