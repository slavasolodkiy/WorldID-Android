/**
 * Handwritten hooks for endpoints added post-codegen:
 *   - POST /api/auth/login
 *   - POST /api/auth/logout
 *   - GET  /api/auth/me
 *   - POST /api/identity/verify/complete
 *   - GET  /api/identity/verify/sessions
 *
 * These follow the same patterns as the generated api.ts file so they
 * integrate cleanly with the rest of the client layer.
 */

import {
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseQueryResult,
  type UseMutationOptions,
  type UseMutationResult,
  type QueryKey,
  type QueryFunction,
} from "@tanstack/react-query";
import { customFetch, type ErrorType, type BodyType } from "./custom-fetch";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthSession {
  userId: string | null;
  worldId?: string;
  username?: string;
  verificationLevel?: string;
}

export interface LoginBody {
  worldId?: string;
  username?: string;
}

export interface VerificationSessionItem {
  sessionId: string;
  status: "pending" | "completed" | "expired" | "failed" | "processing";
  level: string;
  expiresAt: string;
  createdAt: string;
}

export interface CompleteVerificationBody {
  sessionId: string;
  nullifierHash?: string;
  merkleRoot?: string;
  proof?: string;
}

export interface CompleteVerificationResult {
  success: boolean;
  level: string;
  verificationLevel: string;
  alreadyCompleted: boolean;
}

// ─── Auth / me ───────────────────────────────────────────────────────────────

export const getGetMeUrl = () => `/api/auth/me`;

export const getMe = async (options?: RequestInit): Promise<AuthSession> =>
  customFetch<AuthSession>(getGetMeUrl(), { ...options, method: "GET" });

export const getGetMeQueryKey = () => [`/api/auth/me`] as const;

export const getGetMeQueryOptions = <
  TData = Awaited<ReturnType<typeof getMe>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
  request?: RequestInit;
}) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetMeQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getMe>>> = ({ signal }) =>
    getMe({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getMe>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useGetMe<
  TData = Awaited<ReturnType<typeof getMe>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
  request?: RequestInit;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getGetMeQueryOptions(options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey: queryOptions.queryKey };
}

// ─── Auth / login ─────────────────────────────────────────────────────────────

export const getLoginUrl = () => `/api/auth/login`;

export const login = async (
  data: BodyType<LoginBody>,
  options?: RequestInit,
): Promise<AuthSession> =>
  customFetch<AuthSession>(getLoginUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });

export const getLoginMutationOptions = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof login>>,
    TError,
    { data: BodyType<LoginBody> },
    TContext
  >;
}) => {
  const mutationFn = ({ data }: { data: BodyType<LoginBody> }) => login(data);
  return { mutationFn, ...options?.mutation };
};

export type LoginMutationResult = NonNullable<Awaited<ReturnType<typeof login>>>;
export type LoginMutationBody = BodyType<LoginBody>;
export type LoginMutationError = ErrorType<unknown>;

export const useLogin = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof login>>,
    TError,
    { data: BodyType<LoginBody> },
    TContext
  >;
}): UseMutationResult<
  Awaited<ReturnType<typeof login>>,
  TError,
  { data: BodyType<LoginBody> },
  TContext
> => useMutation(getLoginMutationOptions(options));

// ─── Auth / logout ───────────────────────────────────────────────────────────

export const getLogoutUrl = () => `/api/auth/logout`;

export const logout = async (options?: RequestInit): Promise<{ ok: boolean }> =>
  customFetch<{ ok: boolean }>(getLogoutUrl(), { ...options, method: "POST" });

export const getLogoutMutationOptions = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof logout>>,
    TError,
    void,
    TContext
  >;
}) => {
  const mutationFn = () => logout();
  return { mutationFn, ...options?.mutation };
};

export const useLogout = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof logout>>,
    TError,
    void,
    TContext
  >;
}): UseMutationResult<
  Awaited<ReturnType<typeof logout>>,
  TError,
  void,
  TContext
> => useMutation(getLogoutMutationOptions(options));

// ─── Verification / complete ─────────────────────────────────────────────────

export const getCompleteVerificationUrl = () => `/api/identity/verify/complete`;

export const completeVerification = async (
  data: BodyType<CompleteVerificationBody>,
  options?: RequestInit,
): Promise<CompleteVerificationResult> =>
  customFetch<CompleteVerificationResult>(getCompleteVerificationUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });

export const getCompleteVerificationMutationOptions = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof completeVerification>>,
    TError,
    { data: BodyType<CompleteVerificationBody> },
    TContext
  >;
}) => {
  const mutationFn = ({ data }: { data: BodyType<CompleteVerificationBody> }) =>
    completeVerification(data);
  return { mutationFn, ...options?.mutation };
};

export type CompleteVerificationMutationResult = NonNullable<
  Awaited<ReturnType<typeof completeVerification>>
>;
export type CompleteVerificationMutationError = ErrorType<unknown>;

export const useCompleteVerification = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof completeVerification>>,
    TError,
    { data: BodyType<CompleteVerificationBody> },
    TContext
  >;
}): UseMutationResult<
  Awaited<ReturnType<typeof completeVerification>>,
  TError,
  { data: BodyType<CompleteVerificationBody> },
  TContext
> => useMutation(getCompleteVerificationMutationOptions(options));

// ─── Verification / sessions ─────────────────────────────────────────────────

export const getGetVerificationSessionsUrl = () => `/api/identity/verify/sessions`;

export const getVerificationSessions = async (
  options?: RequestInit,
): Promise<VerificationSessionItem[]> =>
  customFetch<VerificationSessionItem[]>(getGetVerificationSessionsUrl(), {
    ...options,
    method: "GET",
  });

export const getGetVerificationSessionsQueryKey = () =>
  [`/api/identity/verify/sessions`] as const;

export const getGetVerificationSessionsQueryOptions = <
  TData = Awaited<ReturnType<typeof getVerificationSessions>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: UseQueryOptions<
    Awaited<ReturnType<typeof getVerificationSessions>>,
    TError,
    TData
  >;
  request?: RequestInit;
}) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetVerificationSessionsQueryKey();
  const queryFn: QueryFunction<
    Awaited<ReturnType<typeof getVerificationSessions>>
  > = ({ signal }) => getVerificationSessions({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getVerificationSessions>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useGetVerificationSessions<
  TData = Awaited<ReturnType<typeof getVerificationSessions>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: UseQueryOptions<
    Awaited<ReturnType<typeof getVerificationSessions>>,
    TError,
    TData
  >;
  request?: RequestInit;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getGetVerificationSessionsQueryOptions(options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };
  return { ...query, queryKey: queryOptions.queryKey };
}
