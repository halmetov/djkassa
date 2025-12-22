import { clearTokens, getAccessToken, refreshAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/api-url";

const jsonHeaders = {
  "Content-Type": "application/json",
};

function normalizeApiPath(path: string): string {
  if (!path) return path;
  const [pathname, query] = path.split("?");
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return query ? `${normalizedPath}?${query}` : normalizedPath;
}

type RequestContext = {
  method: string;
  normalizedPath: string;
  url: string;
  origin: string;
};

async function handleResponse<T>(response: Response, context: RequestContext): Promise<T> {
  const raw = await response.text();
  let parsed: unknown = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }

  if (!response.ok) {
    let detail: unknown;
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed)) {
        const first = parsed[0] as any;
        detail = first?.detail || first?.message || first?.msg;
      } else {
        detail = (parsed as Record<string, unknown>).detail || (parsed as Record<string, unknown>).message;
      }
    }
    const message = detail || (typeof parsed === "string" ? parsed : raw) || `API error: ${response.status}`;
    console.error("API request failed", {
      method: context.method,
      url: context.url,
      status: response.status,
      statusText: response.statusText,
      response: raw,
      body: parsed,
    });
    const error = new Error(String(message));
    (error as any).status = response.status;
    (error as any).body = parsed ?? raw;
    throw error;
  }

  if (response.status === 204 || !raw) {
    return {} as T;
  }

  return parsed as T;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers || {});
  const method = (options.method || "GET").toUpperCase();
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const normalizedPath = normalizeApiPath(path);
  const origin = typeof window !== "undefined" ? window.location.origin : "ssr";
  const url = `${API_URL}${normalizedPath}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "omit",
    });
  } catch (error) {
    console.error("Network/transport error while calling API", {
      method,
      url,
      normalizedPath,
      apiUrl: API_URL,
      origin,
      error,
    });
    const errorMessageParts = [
      "Failed to fetch",
      `method=${method}`,
      `url=${url}`,
      `normalizedPath=${normalizedPath}`,
      `API_URL=${API_URL}`,
      `origin=${origin}`,
    ];
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`${errorMessageParts.join(" | ")}${cause ? ` | cause=${cause}` : ""}`);
  }
  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, options, false);
    }
    clearTokens();
  }
  return handleResponse<T>(response, { method, normalizedPath, url, origin });
}

export async function apiGet<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    method: "GET",
    ...options,
  });
}

export async function apiPost<T>(path: string, body: unknown, options: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { ...jsonHeaders, ...(options.headers || {}) },
    body: JSON.stringify(body),
    ...options,
  });
}

export async function apiPut<T>(path: string, body: unknown, options: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    headers: { ...jsonHeaders, ...(options.headers || {}) },
    body: JSON.stringify(body),
    ...options,
  });
}

export async function apiUpload<T>(path: string, formData: FormData, options: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: formData,
    ...options,
  });
}

export async function apiDelete<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    method: "DELETE",
    ...options,
  });
}

export { API_URL };
