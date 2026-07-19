// Rasterise the Maestro mark into the PNGs needed for PWA install + iOS.
// Run: node scripts/generate-icons.mjs  (or: pnpm icons)
import sharp from "sharp";

const bars = `
  <rect x="5" y="8" width="3" height="8" rx="1.5"/>
  <rect x="10.5" y="4" width="3" height="16" rx="1.5"/>
  <rect x="16" y="10" width="3" height="6" rx="1.5"/>`;

// Rounded tile (transparent corners) for "any" icons; full-bleed square for
// apple-touch + maskable (platforms add their own masking/rounding).
const svg = (size, { rounded }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">` +
  `<rect width="24" height="24"${rounded ? ' rx="6"' : ""} fill="#22c55e"/>` +
  `<g fill="#052e16">${bars}</g></svg>`;

const png = (size, opts, out) =>
  sharp(Buffer.from(svg(size, opts)))
    .png()
    .toFile(out);

await Promise.all([
  png(180, { rounded: false }, "src/app/apple-icon.png"),
  png(192, { rounded: true }, "public/icon-192.png"),
  png(512, { rounded: true }, "public/icon-512.png"),
  png(512, { rounded: false }, "public/icon-maskable-512.png"),
]);

console.log("Generated: apple-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png");
