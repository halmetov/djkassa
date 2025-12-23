const normalizeUrl = (url: string) => url.replace(/\/$/, "");

export function resolveApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL ? normalizeUrl(import.meta.env.VITE_API_URL) : null;
  if (envUrl) return envUrl;

  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000";
  }

  const hostname = window.location.hostname || "localhost";
  const isLocalhost = ["localhost", "127.0.0.1"].includes(hostname);
  const targetHost = isLocalhost ? "127.0.0.1" : hostname;
  return `http://${targetHost}:8000`;
}

export const API_URL = resolveApiUrl();
