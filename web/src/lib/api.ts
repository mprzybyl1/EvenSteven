// Cienki wrapper na fetch. `credentials: include` -> cookie sesji leci z każdym
// requestem (w dev przez proxy Vite wygląda to jak same-origin).
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Content-Type: application/json dokładamy TYLKO gdy wysyłamy body. Inaczej
  // żądania bez ciała (logout, DELETE) dostają od Fastify 415 — deklarują JSON,
  // a ciało puste.
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body != null) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Błąd ${res.status}`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export interface User {
  id: string;
  email: string | null;
  displayName: string;
  avatarEmoji?: string | null;
  blikPhone?: string | null;
  bankAccount?: string | null;
  payNote?: string | null;
}
