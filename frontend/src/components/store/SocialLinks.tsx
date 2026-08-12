// src/components/store/SocialLinks.tsx
// Redes sociales de la tienda — señal que el comprador puede verificar por
// su cuenta (seguidores, historial real), no una garantía de qtienda.
// Compartido entre StorePage (catálogo) y StoreDoor (puerta).

import { Instagram, Facebook } from "lucide-react";

interface SocialStore {
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
}

function TikTokIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

export function SocialLinks({ store, size = 32 }: { store: SocialStore; size?: number }) {
  const links = [
    store.instagram && { key: "instagram", href: `https://instagram.com/${store.instagram}`, icon: Instagram },
    store.tiktok && { key: "tiktok", href: `https://tiktok.com/@${store.tiktok}`, icon: TikTokIcon },
    store.facebook && { key: "facebook", href: `https://facebook.com/${store.facebook}`, icon: Facebook },
  ].filter(Boolean) as { key: string; href: string; icon: React.ElementType }[];

  if (links.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {links.map(({ key, href, icon: Icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center rounded-full flex-shrink-0 transition-transform active:scale-90"
          style={{ width: size, height: size, background: "var(--surface-2)", color: "var(--ink-2)" }}
          aria-label={key}
        >
          <Icon size={Math.round(size * 0.45)} />
        </a>
      ))}
    </div>
  );
}
