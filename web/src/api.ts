const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export class ApiUnavailableError extends Error {
  constructor() {
    super("The API is not reachable from this build.");
    this.name = "ApiUnavailableError";
  }
}

// A static host serving a SPA catch-all answers unknown paths with 200 and
// index.html, so status alone cannot tell us the API is really there. Checking
// the content type is what stops that from surfacing as a JSON parse error.
export async function apiJson<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), init);
  } catch {
    throw new ApiUnavailableError();
  }

  if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
    throw new ApiUnavailableError();
  }

  return { ok: res.ok, status: res.status, data: (await res.json()) as T };
}
