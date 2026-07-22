// Redimensiona y recomprime una imagen en el navegador antes de subirla.
// Las fotos de celular llegan tipicamente en 3-8MB / 3000-4000px — esto las
// deja en unos cientos de KB antes de gastar datos moviles del vendedor en
// subirlas. Sin dependencias nuevas: Canvas nativo del navegador.

export async function compressImage(
  file: File,
  maxDimension: number,
  quality = 0.85
): Promise<File> {
  // GIF: nunca recomprimir a JPEG, perderia la animacion.
  if (file.type === "image/gif") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // formato que el navegador no puede decodificar via createImageBitmap: sube el original, el backend lo valida igual
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bitmap.close(); return file; }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob || blob.size >= file.size) return file; // si no se gano nada, no reemplazar

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
