"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, ImagePlus, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { compressImage } from "@/lib/imageCompression";

interface Props {
  value:      string;
  onChange:   (url: string) => void;
  hint:       string;
  className?: string;
  label?:     string;
  /** Lado mas largo en px al que se reescala antes de subir. Default 1600 (banner/producto); usa 512 para logos. */
  maxDimension?: number;
}

export function ImageUpload({
  value,
  onChange,
  hint,
  className = "h-40 w-full",
  label,
  maxDimension = 1600,
}: Props) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging,  setDragging]  = useState(false);
  const [uploaded,  setUploaded]  = useState(false);

  const upload = useCallback(async (file: File) => {
    /* Basic client-side validation */
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Solo se aceptan JPEG, PNG o WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo supera los 5 MB");
      return;
    }

    setUploading(true);
    setUploaded(false);
    try {
      const compressed = await compressImage(file, maxDimension);
      const fd = new FormData();
      fd.append("file", compressed);
      const { data } = await apiClient.post("/uploads/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(data.url);
      setUploaded(true);
      setTimeout(() => setUploaded(false), 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  }, [onChange, maxDimension]);

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }
  function onDragLeave() { setDragging(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  const hintLines = hint.split("\n");

  return (
    <div>
      {label && (
        <label className="field-label">{label}</label>
      )}

      <div
        className={`relative overflow-hidden transition-all duration-200 cursor-pointer ${className}`}
        style={{
          borderRadius: 18,
          border: value
            ? "none"
            : `2px dashed ${dragging ? "var(--brand-500)" : "#CBD5E1"}`,
          background: value
            ? "transparent"
            : dragging
            ? "var(--brand-50)"
            : "var(--surface-1)",
          boxShadow: value ? "var(--shadow-md)" : "none",
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        aria-label={value ? "Cambiar imagen" : "Subir imagen"}
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >

        {/* ── Preview ── */}
        {value ? (
          <>
            <img
              src={value}
              alt="Vista previa"
              className="w-full h-full object-cover"
            />

            {/* Hover overlay */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2
                         opacity-0 hover:opacity-100 transition-opacity duration-200"
              style={{ background: "rgba(15,23,42,.55)" }}
            >
              <ImagePlus size={24} color="white" />
              <span className="text-white text-xs font-bold">Cambiar imagen</span>
            </div>

            {/* Success flash */}
            {uploaded && (
              <div
                className="absolute inset-0 flex items-center justify-center animate-fade-in"
                style={{ background: "rgba(16,185,129,.45)" }}
              >
                <CheckCircle2 size={40} color="white" />
              </div>
            )}

            {/* Remove button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center
                         justify-center transition-colors"
              style={{ background: "rgba(15,23,42,.65)" }}
              aria-label="Quitar imagen"
            >
              <X size={14} color="white" />
            </button>
          </>
        ) : (

          /* ── Empty / upload zone ── */
          <div className="flex flex-col items-center justify-center w-full h-full gap-2 p-4 text-center select-none">
            {uploading ? (
              <>
                {/* Progress ring */}
                <div className="relative w-10 h-10">
                  <svg className="animate-spin w-10 h-10" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="16" stroke="#E2E8F0" strokeWidth="4" />
                    <circle
                      cx="20" cy="20" r="16"
                      stroke="var(--brand-600)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray="60 40"
                    />
                  </svg>
                </div>
                <p className="text-xs font-semibold" style={{ color: "var(--brand-600)" }}>
                  Subiendo…
                </p>
              </>
            ) : (
              <>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
                  style={{
                    background: dragging ? "var(--brand-100)" : "var(--surface-0)",
                    border:     `1.5px solid ${dragging ? "var(--brand-200)" : "#E2E8F0"}`,
                  }}
                >
                  <Upload size={20} style={{ color: dragging ? "var(--brand-600)" : "var(--ink-3)" }} />
                </div>
                <p className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>
                  {dragging ? "Suelta aquí" : "Arrastra o haz clic"}
                </p>
                {hintLines.map((line, i) => (
                  <p key={i} className="text-[10px]" style={{ color: "var(--ink-3)" }}>
                    {line}
                  </p>
                ))}
              </>
            )}
          </div>
        )}

        {/* Uploading overlay on existing image */}
        {uploading && value && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(15,23,42,.45)" }}
          >
            <div className="relative w-10 h-10">
              <svg className="animate-spin w-10 h-10" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,.3)" strokeWidth="4" />
                <circle
                  cx="20" cy="20" r="16"
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="60 40"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onInputChange}
        aria-hidden
      />
    </div>
  );
}
