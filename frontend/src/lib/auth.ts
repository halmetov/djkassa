import { API_URL } from "@/lib/api-url";

const ACCESS_TOKEN_KEY = "kassa_access_token";
const REFRESH_TOKEN_KEY = "kassa_refresh_token";

export type AuthUser = {
  id: number;
  login: string;
  name: string;
  role: string;
  active: boolean;
  branch_id: number | null;
  branch_name?: string | null;
};

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function login(login: string, password: string) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    credentials: "include",
    body: new URLSearchParams({ username: login, password }).toString(),
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const error = await response.json().catch(() => null);
      const detail = error?.detail;
      throw new Error(detail || "Неверный логин или пароль");
    }
    const errorText = await response.text();
    throw new Error(errorText || "Неверный логин или пароль");
  }
  const data = await response.json();
  setTokens(data.access_token, data.refresh_token);
  return getCurrentUser();
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    clearTokens();
    return null;
  }
  const data = await response.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = getAccessToken();
  if (!token) return null;
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return getCurrentUser();
    }
    return null;
  }
  if (!response.ok) {
    let detail: string | null = null;
    try {
      const body = await response.json();
      detail = body?.detail || body?.message;
    } catch {
      // ignore parse errors, fallback to text
    }
    if (!detail) {
      try {
        detail = await response.text();
      } catch {
        detail = null;
      }
    }
    throw new Error(detail || `Не удалось получить профиль (status ${response.status})`);
  }
  return response.json();
}

export function signOut() {
  clearTokens();
}
