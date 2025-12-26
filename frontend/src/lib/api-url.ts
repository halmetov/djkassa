const normalizeUrl = (url: string) => url.replace(/\/$/, "");

let hasLoggedApiUrl = false;
const logApiUrl = (resolvedUrl: string) => {
  if (hasLoggedApiUrl) return;
  // eslint-disable-next-line no-console
  console.info(`[config] API_URL=${resolvedUrl}`);
  hasLoggedApiUrl = true;
};

export function resolveApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL ? normalizeUrl(import.meta.env.VITE_API_URL) : null;
  if (envUrl) {
    logApiUrl(envUrl);
    return envUrl;
  }

  if (typeof window === "undefined") {
    const fallback = "http://localhost:8000";
    logApiUrl(fallback);
    return fallback;
  }

  const hostname = window.location.hostname || "localhost";
  const isLocalhost = ["localhost", "127.0.0.1"].includes(hostname);
  const targetHost = isLocalhost ? "localhost" : hostname;
  const fallback = `http://${targetHost}:8000`;
  logApiUrl(fallback);
  return fallback;
}

export const API_URL = resolveApiUrl();
