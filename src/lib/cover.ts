// Deterministic gradient + accent from a string (book title).
const PALETTES: { from: string; to: string; accent: string }[] = [
  { from: "#3a2418", to: "#1a0e08", accent: "#c9a96e" },
  { from: "#5a1818", to: "#2a0808", accent: "#f4d35e" },
  { from: "#8a2a2a", to: "#3a0e0e", accent: "#ffd9a0" },
  { from: "#1a2a4a", to: "#0a1530", accent: "#e8c547" },
  { from: "#4a1a1a", to: "#1a0808", accent: "#e8e8e8" },
  { from: "#c2785a", to: "#7a3a1a", accent: "#fff3d6" },
  { from: "#2a3a4a", to: "#0e1a2a", accent: "#e8d9b8" },
  { from: "#1a3a4a", to: "#0a1a2a", accent: "#f0a8a8" },
  { from: "#7a9a6a", to: "#3a5a3a", accent: "#fff3d6" },
  { from: "#3a1a4a", to: "#150830", accent: "#e8a8ff" },
];

export function paletteFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

export function gradientFor(seed: string) {
  const p = paletteFor(seed);
  return `linear-gradient(135deg, ${p.from}, ${p.to})`;
}

// ---------- Shared image compression ----------

export interface CompressResult {
  dataUrl: string;
  bytes: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("image-load"));
    i.src = src;
  });
}

/**
 * Resize/compress an image File to JPEG. Constrain by `maxWidth` (book covers)
 * and/or `maxEdge` (page photos); the smaller scale wins. Single shared
 * implementation used by the book and workspace stores.
 */
export async function compressImageToJpeg(
  file: File,
  opts: { maxEdge?: number; maxWidth?: number; quality?: number } = {},
): Promise<CompressResult> {
  const { maxEdge, maxWidth, quality = 0.82 } = opts;
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  let scale = 1;
  if (maxWidth) scale = Math.min(scale, maxWidth / Math.max(img.width, 1));
  if (maxEdge) scale = Math.min(scale, maxEdge / Math.max(img.width, img.height, 1));

  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl: out, bytes: Math.round((out.length * 3) / 4) };
}
