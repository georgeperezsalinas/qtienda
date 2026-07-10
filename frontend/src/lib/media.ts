const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || "";

function apiOrigin() {
  try {
    return new URL(API_URL).origin;
  } catch {
    return "";
  }
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) return "";

  if (url.startsWith("/uploads/")) {
    return joinUrl(CDN_URL || apiOrigin(), url);
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/uploads/")) {
      return joinUrl(CDN_URL || apiOrigin() || parsed.origin, parsed.pathname);
    }
  } catch {
    return url;
  }

  return url;
}
