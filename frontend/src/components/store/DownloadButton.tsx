"use client";

// Descarga un archivo digital SIN salir de la pantalla: baja el archivo con
// fetch y lo entrega al navegador como blob con <a download>. Navegar
// directo al link (o abrirlo con target=_blank) dejaba en el celular una
// pestaña en blanco mientras el archivo bajaba por detrás — se leía como
// que la compra había fallado. Si el fetch falla (red, CORS raro), recién
// ahí cae al comportamiento viejo de abrir el link en otra pestaña.

import { useState, type CSSProperties, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { fetchAndSaveFile } from "@/lib/download";

interface Props {
  url: string;
  filename: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export default function DownloadButton({ url, filename, className, style, children }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      await fetchAndSaveFile(url, filename);
      toast.success("📥 Listo — revisa tus descargas", { duration: 3000 });
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className}
      style={{ ...style, opacity: loading ? 0.85 : undefined }}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin flex-shrink-0" />
          Descargando…
        </span>
      ) : (
        children
      )}
    </button>
  );
}
