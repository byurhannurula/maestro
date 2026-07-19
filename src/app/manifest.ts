import type { MetadataRoute } from "next";

/** PWA manifest — makes Maestro installable (home screen / standalone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maestro",
    short_name: "Maestro",
    description: "Track-first manager for a Navidrome music library.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/logo.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
      {
        src: "/icon-maskable-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
