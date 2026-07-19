/**
 * Deterministic Tailwind gradient class for a seed string, so the same
 * playlist/artist/track always renders the same colours (used where no real
 * artwork exists).
 */
const COVERS = [
  "from-emerald-500 to-teal-700",
  "from-violet-500 to-fuchsia-700",
  "from-sky-500 to-indigo-700",
  "from-amber-500 to-orange-700",
  "from-rose-500 to-pink-700",
  "from-lime-500 to-emerald-700",
  "from-cyan-500 to-blue-700",
];

export function coverGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COVERS[Math.abs(h) % COVERS.length];
}
