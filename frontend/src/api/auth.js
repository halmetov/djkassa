const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

export const getTokens = () => ({
  access: localStorage.getItem(ACCESS_KEY),
  refresh: localStorage.getItem(REFRESH_KEY),
});

export const setTokens = ({ access, refresh }) => {
  if (access) {
    localStorage.setItem(ACCESS_KEY, access);
  }
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  }
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

export const isAuthenticated = () => !!getTokens().access;
