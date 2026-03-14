const ACCESS_TOKEN_KEY = "lensaya_access_token";
const REFRESH_TOKEN_KEY = "lensaya_refresh_token";

const canUseStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

export const getAccessToken = () => {
  return null;
};

export const setAccessToken = (_token: string | null) => {
  void _token;
  if (!canUseStorage()) return;
  // Auth tokens are stored as httpOnly cookies set by the backend.
  // Keep localStorage cleared for migration safety.
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = () => {
  return null;
};

export const setRefreshToken = (_token: string | null) => {
  void _token;
  if (!canUseStorage()) return;
  // Auth tokens are stored as httpOnly cookies set by the backend.
  // Keep localStorage cleared for migration safety.
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const clearAuthTokens = () => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
};
