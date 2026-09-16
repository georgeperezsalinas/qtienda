// Descarga un archivo vía fetch+blob en vez de navegar al link directo —
// ver DownloadButton.tsx para el porqué (pestaña en blanco en mobile
// mientras el archivo baja por detrás, se leía como compra fallida).
export async function fetchAndSaveFile(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se libera después, no al toque: algunos navegadores móviles todavía
  // están leyendo el blob cuando vuelve el click().
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
