import axios from "axios";
import { clearTokens, getTokens, setTokens } from "./auth";
import { BASE_URL } from "../config/api";

export const api = axios.create({
  baseURL: BASE_URL,
});

let isRefreshing = false;
let refreshPromise = null;

api.interceptors.request.use((config) => {
  const { access } = getTokens();
  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;

    if (status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;
      const { refresh } = getTokens();

      if (!refresh) {
        clearTokens();
        return Promise.reject(error);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = api
          .post("/auth/token/refresh/", { refresh })
          .then((response) => {
            const { access: newAccess, refresh: newRefresh } = response.data;
            setTokens({ access: newAccess, refresh: newRefresh ?? refresh });
            isRefreshing = false;
            return newAccess;
          })
          .catch((refreshError) => {
            isRefreshing = false;
            clearTokens();
            throw refreshError;
          });
      }

      try {
        const newAccess = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const login = async ({ username, password }) => {
  const response = await api.post("/auth/token/", { username, password });
  setTokens(response.data);
  return response.data;
};

export const logout = () => {
  clearTokens();
};

export const fetchCustomers = async () => {
  const response = await api.get("/customers/");
  return response.data;
};
