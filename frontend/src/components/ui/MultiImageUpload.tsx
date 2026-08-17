"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Plus, X, Star, ZoomIn } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { compressImage } from "@/lib/imageCompression";

const MAX_DIMENSION = 1600; // fotos de producto: grilla + ficha con zoom comparten el mismo archivo

export interface FormImage {
  id?: string;   // ID del servidor (undefined si es nueva)
  url: string;
}

interface Props {
  images: FormImage[];
  onChange: (images: FormImage[]) => void;
  maxImages?: number;
  endpoint?: string;
  itemLabel?: string;
}

export function MultiImageUpload({ images, onChange, maxImages = 6, endpoint = "/uploads/image", itemLabel = "fotos por producto" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const canAdd = images.length < maxImages && !uploading;

  const upload = useCallback(
    async (files: FileList) => {
      const valid = Array.from(files).filter((f) => {
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
          toast.error(`Solo se aceptan JPEG, PNG o WebP`);
          return false;
        }
        if (f.size > 5 * 1024 * 1024) {
          toast.error(`${f.name} supera los 5 MB`);
          return false;
        }
        return true;
      });

      const slots = maxImages - images.length;
      const batch = valid.slice(0, slots);
      if (valid.length > slots) {
        toast(`Máximo ${maxImages} ${itemLabel}`);
      }
      if (batch.length === 0) return;

      setUploading(true);
      try {
        const uploaded: FormImage[] = [];
        for (const file of batch) {
          const compressed = await compressImage(file, MAX_DIMENSION);
          const fd = new FormData();
          fd.append("file", compressed);
          const { data } = await apiClient.post(endpoint, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          uploaded.push({ url: data.url });
        }
        onChange([...images, ...uploaded]);
      } catch (err: any) {
        toast.error(err.response?.data?.detail ?? "Error al subir imagen");
      } finally {
        setUploading(false);
      }
    },
    [images, onChange, maxImages]
  );

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) upload(e.target.files);
    e.target.value = "";
  }

  function remove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  /* Mover al primer lugar = hacer principal */
  function makePrimary(index: number) {
    if (index === 0) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    onChange(next);
  }

  return (
    <div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 select-none">
        {images.map((img, i) => (
          <div
            key={img.id ?? `${img.url}-${i}`}
            className="relative flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden"
            style={{
              border: i === 0
                ? "2.5px solid var(--accent)"
                : "2px solid #E2E8F0",
              cursor: i === 0 ? "default" : "pointer",
            }}
            onClick={() => makePrimary(i)}
            title={i === 0 ? "Foto principal" : "Tocar para hacer principal"}
          >
            <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />

            {/* Insignia "principal" */}
            {i === 0 && (
              <span
                className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: "var(--ink)" }}
              >
                <Star size={10} fill="white" color="white" />
              </span>
            )}

            {/* Sugerencia "principal" en fotos secundarias */}
            {i > 0 && (
              <div
                className="absolute bottom-0 left-0 right-0 py-0.5 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,.45)" }}
              >
                <span className="text-[9px] text-white font-semibold">Principal</span>
              </div>
            )}

            {/* Botón preview/zoom */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPreviewUrl(img.url); }}
              className="absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "rgba(15,23,42,.65)" }}
              aria-label="Ver imagen"
            >
              <ZoomIn size={9} color="white" />
            </button>

            {/* Botón eliminar */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(i); }}
              className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "rgba(15,23,42,.65)" }}
              aria-label="Eliminar foto"
            >
              <X size={10} color="white" />
            </button>
          </div>
        ))}

        {/* Botón agregar */}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-shrink-0 w-20 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all"
            style={{
              border: "2px dashed #CBD5E1",
              background: "var(--bg)",
              color: "var(--ink-3)",
            }}
          >
            <Plus size={18} />
            <span className="text-[10px] font-semibold">Agregar</span>
          </button>
        )}

        {/* Indicador de carga */}
        {uploading && (
          <div
            className="flex-shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ border: "2px solid var(--accent-soft)", background: "var(--accent-soft)" }}
          >
            <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none"
                 stroke="var(--ink)" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
            </svg>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <p className="text-[10px] mt-2" style={{ color: "var(--ink-3)" }}>
          {images.length === 1
            ? "Toca ＋ para agregar más fotos"
            : "Toca una foto secundaria para hacerla principal"}
          {" · "}{images.length}/{maxImages}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={onInputChange}
        aria-hidden
      />

      {/* Modal de preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,.92)" }}
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="Vista previa"
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: "90dvh" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,.15)" }}
            aria-label="Cerrar"
          >
            <X size={20} color="white" />
          </button>
        </div>
      )}
    </div>
  );
}
