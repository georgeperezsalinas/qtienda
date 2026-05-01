import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import QueryProvider from "@/components/ui/QueryProvider";

export const metadata: Metadata = {
  title: { default: "qtienda.shop", template: "%s | qtienda.shop" },
  description: "Tu tienda online en segundos",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#4f6ef7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 500,
                background: "#1a1a1a",
                color: "#fff",
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}