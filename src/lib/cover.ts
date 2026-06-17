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
