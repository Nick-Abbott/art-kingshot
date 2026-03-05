import { apiFetch } from "../apiClient";
import type { ApiResponse, SessionPayload } from "@shared/types";

export async function fetchSession() {
  const res = await apiFetch("/api/me", { allowNonOk: true });
  if (res.status === 401) {
    return { status: 401 };
  }
  if (!res.ok) {
    const errorMessage =
      res.data && typeof res.data === "object" && "error" in res.data
        ? String((res.data as { error?: unknown }).error || "Failed to load session.")
        : "Failed to load session.";
    return { status: res.status, error: errorMessage };
  }
  const payload = res.data as ApiResponse<SessionPayload>;
  if (!payload || payload.ok === false) {
    return {
      status: res.status,
      error: payload && payload.ok === false ? payload.error : "Failed to load session."
    };
  }
  return { status: res.status, data: payload.data };
}

export async function logout() {
  return apiFetch("/api/auth/logout", { method: "POST", allowNonOk: true });
}
