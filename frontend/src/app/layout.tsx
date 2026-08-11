// src/app/layout.tsx — qtienda v2 (con ErrorBoundary global)
//
// CAMBIOS vs versión anterior:
//   - Agrega <ErrorBoundary> envolviendo toda la app
//   - Si cualquier componente crashea, el usuario ve un mensaje útil
//     en vez de pantalla blanca

import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import QueryProvider from "@/components/ui/QueryProvider";
import { GoogleAuthProvider } from "@/components/ui/GoogleAuthProvider";
import { FacebookAuthProvider } from "@/components/ui/FacebookAuthProvider";
import PWARegister from "@/components/ui/PWARegister";
import FavoritesSync from "@/components/ui/FavoritesSync";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";


export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://qtienda.shop"
  ),
  title: {
    default: "qtienda — Tu tienda online en 2 minutos",
    template: "%s · qtienda",
  },
  description:
    "Crea tu tienda online en 2 minutos. Pedidos directo a tu WhatsApp. Sin comisiones.",
  applicationName: "qtienda",
  manifest: "/manifest.json",
  keywords: [
    "tienda online",
    "ecommerce LatAm",
    "vender en WhatsApp",
    "emprendimiento",
    "Perú",
    "México",
    "Colombia",
  ],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "qtienda",
  },
  openGraph: {
    title: "qtienda",
    description: "Tu tienda online en 2 minutos",
    type: "website",
    locale: "es",
    siteName: "qtienda",
    images: [{ url: "/brand/qtienda-lockup.svg", width: 720, height: 200 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#C5613B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body suppressHydrationWarning>
        {/* ErrorBoundary global — si cualquier componente crashea,
            el usuario ve un mensaje útil en vez de pantalla blanca */}
        <ErrorBoundary>
          <QueryProvider>
            <GoogleAuthProvider>
            <FacebookAuthProvider>
              {children}
              <PWARegister />
              <FavoritesSync />
              <Toaster
                position="top-center"
                toastOptions={{
                  style: {
                    background: "var(--ink)",
                    color: "var(--bg)",
                    border: "1px solid var(--ink)",
                    borderRadius: "12px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    padding: "10px 14px",
                  },
                  success: {
                    iconTheme: { primary: "var(--bg)", secondary: "var(--ink)" },
                  },
                  error: {
                    style: {
                      background: "var(--danger)",
                      color: "#fff",
                      border: "1px solid var(--danger)",
                    },
                  },
                }}
              />
            </FacebookAuthProvider>
            </GoogleAuthProvider>
          </QueryProvider>
          <Analytics />
          <SpeedInsights />
        </ErrorBoundary>
      </body>
    </html>
  );
}
