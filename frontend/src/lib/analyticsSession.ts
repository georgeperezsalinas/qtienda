// Sesion/dispositivo compartidos por storeAnalytics.ts y siteAnalytics.ts —
// mismo qtienda_session para que un visitante se vea como una sola persona
// tanto en landing/tiendas como dentro de una tienda especifica.

export function getSessionId(): string {
  try {
    let id = localStorage.getItem("qtienda_session");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("qtienda_session", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function getDevice(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}
