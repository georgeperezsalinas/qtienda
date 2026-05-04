import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import QueryProvider from "@/components/ui/QueryProvider";
import { GoogleAuthProvider } from "@/components/ui/GoogleAuthProvider";
import PWARegister from "@/components/ui/PWARegister";

export const metadata: Metadata = {
  title: { default: "qtienda.shop — Tu tienda en Redes Sociales", template: "%s | qtienda.shop" },
  description: "Crea tu tienda online en 2 minutos. Recibe pedidos directo a tu WhatsApp.",
  manifest: "/manifest.json",
  keywords: ["tienda online", "TikTok shop", "WhatsApp pedidos", "emprendimiento", "Peru"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "qtienda",
  },
  icons: {
    icon: "/logo_pro_qtienda.ico",
    apple: "/logo_pro_qtienda.ico",
  },
  openGraph: {
    title: "qtienda.shop",
    description: "Tu tienda online en 2 minutos",
    type: "website",
    locale: "es_PE",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full">
        <QueryProvider>
          <PWARegister />
          <GoogleAuthProvider>
          {children}
          </GoogleAuthProvider>
          <Toaster
            position="bottom-center"
            gutter={12}
            toastOptions={{
              duration: 3500,
              style: {
                borderRadius: "14px",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "'Sora', sans-serif",
                background: "#0F172A",
                color: "#F8FAFC",
                padding: "12px 16px",
                boxShadow: "0 8px 32px rgba(15,23,42,.24)",
                maxWidth: "320px",
              },
              success: {
                iconTheme: { primary: "#10B981", secondary: "#fff" },
              },
              error: {
                iconTheme: { primary: "#EF4444", secondary: "#fff" },
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
