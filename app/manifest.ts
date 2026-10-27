import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CONNECT · NOVOGEN",
    short_name: "CONNECT",
    description: "Tu espacio de conexión comercial",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#00071b",
    theme_color: "#00071b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
