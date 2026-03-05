export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  profileId?: string;
  signal?: AbortSignal;
  allowNonOk?: boolean;
};

export type ApiFetchResponse<TData = unknown> = {
  ok: boolean;
  status: number;
  data: TData;
};

export async function apiFetch<TData = unknown>(
  path: string,
  {
    method = "GET",
    headers = {},
    body,
    profileId,
    signal,
    allowNonOk = false
  }: ApiFetchOptions = {}
): Promise<ApiFetchResponse<TData>> {
  const finalHeaders: Record<string, string> = { ...headers };
  let payload: BodyInit | undefined;

  if (profileId) {
    finalHeaders["x-profile-id"] = profileId;
  }
  if (body && !(body instanceof FormData)) {
    if (!finalHeaders["Content-Type"]) {
      finalHeaders["Content-Type"] = "application/json";
    }
    if (finalHeaders["Content-Type"] === "application/json" && typeof body !== "string") {
      payload = JSON.stringify(body);
    } else {
      payload = body as BodyInit;
    }
  } else if (body instanceof FormData) {
    payload = body;
  }

  const res = await fetch(path, {
    method,
    headers: finalHeaders,
    body: payload,
    signal
  });

  let data: unknown = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  if (!res.ok && !allowNonOk) {
    let message = "Request failed.";
    if (data && typeof data === "object" && "error" in data) {
      const maybeError = (data as { error?: unknown }).error;
      if (typeof maybeError === "string" && maybeError) {
        message = maybeError;
      }
    } else if (typeof data === "string" && data) {
      message = data;
    }
    throw new ApiError(message, res.status);
  }

  return { ok: res.ok, status: res.status, data: data as TData };
}
