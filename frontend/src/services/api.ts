import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { getAccessToken } from "../lib/auth";

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

export class ServiceApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 500, details: unknown = null) {
    super(message);
    this.name = "ServiceApiError";
    this.status = status;
    this.details = details;
  }
}

const BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    if (!("Authorization" in config.headers)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await api.request<ApiEnvelope<T>>(config);
    const payload = response.data;

    if (!payload) {
      throw new ServiceApiError("Empty response from server", response.status);
    }

    if (!payload.success) {
      throw new ServiceApiError(payload.error || "Request failed", response.status, payload);
    }

    return payload.data as T;
  } catch (err) {
    if (err instanceof ServiceApiError) {
      throw err;
    }

    if (err instanceof AxiosError) {
      const status = err.response?.status || 500;
      const payload = err.response?.data as ApiEnvelope<T> | undefined;
      throw new ServiceApiError(
        payload?.error || err.message || "Request failed",
        status,
        payload || err.response?.data || null
      );
    }

    if (err instanceof Error) {
      throw new ServiceApiError(err.message);
    }

    throw new ServiceApiError("Unknown request error");
  }
}
