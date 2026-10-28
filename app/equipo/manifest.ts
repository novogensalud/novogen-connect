import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/equipo",
    name: "CONNECT · Equipo comercial",
    short_name: "CONNECT Equipo",
    description: "Prospectos y tareas del equipo comercial",
    start_url: "/equipo",
    scope: "/",
    display: "standalone",
    background_color: "#f3f7fa",
    theme_color: "#153c52",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
