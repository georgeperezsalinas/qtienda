# Integración de marca · qtienda

Guía paso a paso para integrar el logo y el ícono de app en tu frontend Next.js.

---

## 📦 Contenido del paquete

```
assets/
├── manifest.json                         → manifest del PWA
├── favicon.svg                            → favicon vectorial (modern browsers)
├── favicon-16.png                         → fallback 16px
├── favicon-32.png                         → fallback 32px
├── logo/
│   ├── qtienda-mark.svg                  → solo el símbolo "q" (tinta + clay)
│   ├── qtienda-mark-white.svg            → símbolo blanco (sobre fondos oscuros)
│   ├── qtienda-icon-clay.svg             → símbolo en tile clay (uso en cards)
│   ├── qtienda-icon-paper.svg            → símbolo en tile papel
│   ├── qtienda-icon-ink.svg              → símbolo en tile tinta
│   ├── qtienda-lockup.svg                → marca completa: símbolo + "qtienda"
│   ├── qtienda-lockup-white.svg          → versión blanca
│   ├── qtienda-wordmark.svg              → solo "qtienda"
│   └── qtienda-wordmark-white.svg        → wordmark blanco
└── icon/
    ├── icon-{16..512}.png                → PNG en 16 tamaños
    ├── apple-touch-icon.png              → 180×180 para iOS
    ├── icon-maskable-192.png             → adaptive icon Android
    └── icon-maskable-512.png             → adaptive icon Android (full)
```

---

## 🚀 Paso 1 · Copia los archivos al `public/`

En tu repo Next.js, dentro de `public/`:

```
public/
├── favicon.svg                ← desde assets/favicon.svg
├── favicon-16.png             ← desde assets/favicon-16.png
├── favicon-32.png             ← desde assets/favicon-32.png
├── apple-touch-icon.png       ← desde assets/icon/apple-touch-icon.png
├── manifest.json              ← desde assets/manifest.json
├── icons/                     ← todo el contenido de assets/icon/
│   ├── icon-72.png
│   ├── icon-96.png
│   └── ...
└── brand/                     ← todo el contenido de assets/logo/
    ├── qtienda-mark.svg
    ├── qtienda-lockup.svg
    └── ...
```

> ⚠️ Si serviste `manifest.json` desde una ruta distinta (por ejemplo `/site.webmanifest`), actualiza la ruta en el paso 3.

---

## 🚀 Paso 2 · Reemplaza el componente `Logo`

Tu archivo actual es `src/components/ui/Logo.tsx`. Reemplázalo por:

```tsx
// src/components/ui/Logo.tsx
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
  variant?: "default" | "white" | "mark-only";
}

const SIZES = {
  sm: { mark: 18, text: 14 },
  md: { mark: 22, text: 18 },
  lg: { mark: 32, text: 26 },
};

export default function Logo({
  size = "md",
  href = "/",
  className = "",
  variant = "default",
}: LogoProps) {
  const { mark, text } = SIZES[size];
  const color = variant === "white" ? "#FFFFFF" : "#14130F";
  const accent = variant === "white" ? "#FFFFFF" : "#C5613B";

  const content = (
    <span
      className={"inline-flex items-center " + className}
      style={{ gap: text * 0.42, color }}
    >
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="38" cy="38" r="28" stroke="currentColor" strokeWidth="8" />
        <path
          d="M 58 58 L 82 82"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle cx="84" cy="84" r="7.6" fill={accent} />
      </svg>
      {variant !== "mark-only" && (
        <span
          style={{
            fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
            fontWeight: 500,
            fontSize: text,
            letterSpacing: "-0.035em",
            lineHeight: 1,
          }}
        >
          qtienda
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return <Link href={href} aria-label="qtienda">{content}</Link>;
}
```

**Uso:**
```tsx
<Logo size="md" />                          // por defecto, links a /
<Logo size="lg" variant="white" />          // sobre fondos oscuros
<Logo size="sm" variant="mark-only" />      // solo el símbolo
<Logo href="" />                            // sin link (en footer)
```

---

## 🚀 Paso 3 · Mete el favicon + manifest en el `<head>`

En `src/app/layout.tsx`:

```tsx
// src/app/layout.tsx
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "qtienda · tu tienda online en 2 minutos",
    template: "%s · qtienda",
  },
  description: "Crea tu tienda online en 2 minutos. Sin comisiones, pedidos a tu WhatsApp.",
  applicationName: "qtienda",
  manifest: "/manifest.json",

  icons: {
    icon: [
      { url: "/favicon.svg",     type: "image/svg+xml"               },
      { url: "/favicon-32.png",  sizes: "32x32", type: "image/png"  },
      { url: "/favicon-16.png",  sizes: "16x16", type: "image/png"  },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },

  appleWebApp: {
    capable: true,
    title: "qtienda",
    statusBarStyle: "default",        // o "black-translucent" si quieres immersive
  },

  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: "qtienda",
    images: [
      { url: "/brand/qtienda-lockup.svg", width: 720, height: 200 },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#C5613B",            // el color clay del ícono / barra de estado
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

> Next.js 13.4+ con `metadata` y `viewport` exportados genera todos los `<link>` y `<meta>` automáticamente. No necesitas escribirlos a mano.

---

## 🚀 Paso 4 · Fuente Geist

Tu app usa Sora + DM Sans. Pásala a **Geist + Geist Mono** para que el wordmark del logo case con el resto.

### Opción A · `next/font` (recomendada — sin layout shift)

```tsx
// src/app/layout.tsx
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

Luego en `globals.css`:

```css
:root {
  --font-sans: var(--font-sans, "Geist", ui-sans-serif, system-ui, sans-serif);
  --font-mono: var(--font-mono, "Geist Mono", ui-monospace, monospace);
}

body {
  font-family: var(--font-sans);
}
```

> 🔧 **Reemplaza** los `@import` de `Sora` y `DM Sans` en tu `globals.css`. Quítalos.

---

## 🚀 Paso 5 · Tokens de color (opcional pero recomendado)

Reemplaza la sección `:root` de tu `globals.css` con la nueva paleta:

```css
:root {
  /* Surfaces */
  --bg:        #F7F5F0;
  --surface:   #FCFBF7;
  --surface-2: #F0EDE5;
  --tint:      #EEEAE0;

  /* Ink */
  --ink:   #14130F;
  --ink-2: #4A4843;
  --ink-3: #8B887F;
  --ink-4: #B8B4A5;
  --ink-5: #DAD5C5;

  /* Lines */
  --line:   #E7E3D6;
  --line-2: #D8D2C0;

  /* Accent */
  --accent:      #C5613B;
  --accent-ink:  #8A3F1F;
  --accent-soft: #F4E5D8;

  /* Semantic */
  --success: #4F6B3F;
  --warn:    #A86E2C;
  --danger:  #A8453B;
}
```

Reemplaza las referencias `var(--brand-*)` por `var(--accent)` o `var(--ink)` según el caso (los CTAs primarios pasan de azul brand a **tinta** — el clay queda reservado para acción crítica como "confirmar pedido").

---

## ✅ Verificación rápida

1. **Favicon en navegador**
   `localhost:3000` → la pestaña muestra el ícono clay con la "q" blanca.
2. **Instalable como PWA**
   Chrome → menú → "Instalar qtienda" debe aparecer.
   Una vez instalada, el icono en escritorio/launcher debe ser el clay.
3. **iOS · Agregar a inicio**
   Safari iOS → compartir → "Agregar a pantalla de inicio" → debe usar `apple-touch-icon.png` (clay, sin bordes blancos).
4. **Android · Adaptive icon**
   Algunos launchers (Pixel, OneUI) cortarán el ícono en círculo. Como tenemos `icon-maskable-*.png` con safe zone, la marca queda centrada y no se corta.
5. **Theme color**
   La barra de estado en Chrome móvil debe pintarse de clay (#C5613B) al abrir la app.

---

## 🧭 Reglas de uso

- **Acento clay (#C5613B) solo para acción crítica:** confirmar pedido, CTA primario en checkout. NO lo uses como background general — pierde fuerza.
- **CTAs neutrales en tinta (#14130F):** "Crear tienda", "Guardar", "Continuar". El negro es tu botón primario.
- **El símbolo nunca cambia de color por la tienda del vendedor.** El `store.primary_color` se usa solo dentro del storefront del vendedor, no en el chrome de qtienda.
- **Tamaño mínimo del símbolo: 16px.** Por debajo de eso usa el wordmark solo.
- **Área de respeto:** mínimo igual al diámetro del punto clay alrededor del símbolo. No metas texto pegado.

---

## 🛟 Ayuda

Si algo no encaja con tu codebase (Next pages router en vez de app router, otra estructura de carpetas, configuración PWA con `next-pwa`, etc.) pasa el detalle y te lo ajusto.
