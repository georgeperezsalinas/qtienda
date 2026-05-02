// lib/api-server.ts — Server component fetcher
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://api:8000/api/v1";

export async function apiServer(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    next: { revalidate: 5 },    // ISR — revalidate every 5s
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}
