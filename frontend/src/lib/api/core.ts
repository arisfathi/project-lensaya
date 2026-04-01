import { getAccessToken } from "../auth";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  auth?: boolean;
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

export const DEFAULT_LIST_PAGE = 1;
export const DEFAULT_REFERRAL_EVENTS_LIMIT = 20;
export const MAX_REFERRAL_EVENTS_LIMIT = 100;

export class ApiClientError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 500, details: unknown = null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

export const isApiAccessError = (error: unknown) =>
  error instanceof ApiClientError && (error.status === 401 || error.status === 403);

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");

export const toUrl = (path: string, query?: RequestOptions["query"]) => {
  const normalized = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const url = new URL(normalized, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  const isAbsoluteUrl = /^https?:\/\//i.test(normalized);
  return isAbsoluteUrl ? url.toString() : `${url.pathname}${url.search}`;
};

export const toPositiveInt = (value: number | undefined, fallback: number) => {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAccessToken();
  const method = options.method || "GET";
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (isFormData) {
    Object.keys(headers).forEach((key) => {
      if (key.toLowerCase() === "content-type") {
        delete headers[key];
      }
    });
  }
  if (!isFormData && options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(toUrl(path, options.query), {
    method,
    headers,
    credentials: options.credentials ?? "include",
    body:
      options.body === undefined
        ? undefined
        : isFormData
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });

  let payload: ApiEnvelope<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new ApiClientError("Invalid server response", response.status, text);
    }
  }

  if (!response.ok) {
    throw new ApiClientError(
      payload?.error || `Request failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  if (!payload) {
    throw new ApiClientError("Empty response from server", response.status);
  }

  if (!payload.success) {
    throw new ApiClientError(payload.error || "Request failed", response.status, payload);
  }

  return payload.data as T;
}



export const getApiErrorMessage = (error: unknown, fallback = "Something went wrong") => {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};





































