import { apiFetch } from "../apiClient";
import type { ApiResponse, SessionPayload } from "@shared/types";

type SessionResponse = ApiResponse<SessionPayload> | { error?: unknown } | string | null;

const hasErrorField = (value: unknown): value is { error?: unknown } =>
  Boolean(value && typeof value === "object" && "error" in value);

export async function fetchSession() {
  const res = await apiFetch<SessionResponse>("/api/me", { allowNonOk: true });
  if (res.status === 401) {
    return { status: 401 };
  }
  if (!res.ok) {
    const errorMessage =
      hasErrorField(res.data)
        ? String(res.data.error || "Failed to load session.")
        : "Failed to load session.";
    return { status: res.status, error: errorMessage };
  }
  const payload = res.data;
  if (!payload || typeof payload !== "object" || !("ok" in payload) || payload.ok === false) {
    return {
      status: res.status,
      error:
        payload && typeof payload === "object" && "ok" in payload && payload.ok === false
          ? payload.error
          : "Failed to load session."
    };
  }
  return { status: res.status, data: payload.data };
}

export async function logout() {
  return apiFetch("/api/auth/logout", { method: "POST", allowNonOk: true });
}
