import type { Metadata } from "next";

// Manifest e iconos propios para que "Mall Qtienda" se pueda instalar como
// app aparte de qtienda (icono morado con bolsa, distinto al naranja/lupa).
export const metadata: Metadata = {
  // Refuerzo del redirect www→apex de nginx — sin esto Google no tenía
  // ninguna señal de cuál era la versión canónica de /tiendas.
  alternates: { canonical: "/tiendas" },
  applicationName: "Mall Qtienda",
  manifest: "/manifest-mall.json",
  icons: {
    apple: [{ url: "/icon-mall/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mall Qtienda",
  },
};

export default function TiendasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
