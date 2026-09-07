"use client";

import { useRef, useState } from "react";
import { Upload, FileText, X, CheckCircle2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";

export interface DigitalFile {
  key: string;
  name: string;
  size: number;
  // undefined = archivo ya existente (no se subió en esta sesión, no hay
  // forma de saber si sigue íntegro sin volver a bajarlo) — solo se marca
  // true/false para un archivo recién subido ahora mismo.
  verified?: boolean;
}

const ALLOWED_EXT = [".pdf", ".epub", ".mobi", ".zip", ".docx", ".mp3", ".mp4"];
const MAX_MB = 200;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DigitalFileUpload({
  file, onChange,
}: {
  file: DigitalFile | null;
  onChange: (file: DigitalFile | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(f: File) {
    const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      toast.error(`Tipo de archivo no permitido. Usa: ${ALLOWED_EXT.join(", ")}`);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Archivo muy grande. Máximo ${MAX_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await apiClient.post("/uploads/digital-file", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        // El timeout global del cliente (15s) es para requests normales —
        // acá se sube el archivo Y el backend lo vuelve a bajar para
        // verificarlo, así que en una conexión lenta con un PDF de varios
        // MB se pasa fácil. Generoso a propósito: hasta 200MB permitidos.
        timeout: 300_000,
      });
      onChange({ key: data.key, name: data.filename, size: data.size, verified: !!data.verified });
      if (!data.verified) {
        toast.error("El archivo se subió pero no se pudo confirmar que quedó accesible — vuelve a intentarlo antes de publicar.", { duration: 6000 });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
    e.target.value = "";
  }

  if (file) {
    return (
      <div>
        <div
          className="flex items-center gap-2.5 rounded-xl p-3"
          style={{ border: "1.5px solid var(--line-2)", background: "var(--surface-2)" }}
        >
          <FileText size={18} style={{ color: "var(--accent)" }} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate" style={{ color: "var(--ink)" }}>{file.name}</p>
            <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>{formatSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--danger-soft)" }}
            aria-label="Quitar archivo"
          >
            <X size={13} style={{ color: "var(--danger)" }} />
          </button>
        </div>
        {file.verified === true && (
          <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: "var(--success)" }}>
            <CheckCircle2 size={11} /> Verificado — se pudo volver a descargar sin problema
          </p>
        )}
        {file.verified === false && (
          <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: "var(--danger)" }}>
            <AlertTriangle size={11} /> No se pudo confirmar que quedó accesible — quítalo y súbelo de nuevo antes de publicar
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center justify-center gap-2 w-full rounded-xl text-sm font-bold py-3.5 disabled:opacity-60"
        style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1.5px dashed var(--line-2)" }}
      >
        <Upload size={16} />
        {uploading ? "Subiendo..." : "Subir archivo (PDF, EPUB, ZIP...)"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXT.join(",")}
        className="hidden"
        onChange={onInputChange}
        aria-hidden
      />
    </>
  );
}
