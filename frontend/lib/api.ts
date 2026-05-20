const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function apiFetch(
  path: string,
  getToken: () => Promise<string | null>,
  options: RequestOptions = {}
): Promise<Response> {
  const token = await getToken();
  const { body, ...rest } = options;

  return fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export async function apiJson<T>(
  path: string,
  getToken: () => Promise<string | null>,
  options: RequestOptions = {}
): Promise<T> {
  const res = await apiFetch(path, getToken, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}
