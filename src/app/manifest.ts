import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Caporal — Inventario",
    short_name: "Caporal",
    description: "Control de inventario, minibares y dotación del hotel.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#232120",
    theme_color: "#232120",
    lang: "es-CO",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Sacar producto", short_name: "Sacar", url: "/movimientos/salida" },
      { name: "Revisar suite", short_name: "Suite", url: "/suites" },
      { name: "Alertas", short_name: "Alertas", url: "/alertas" },
    ],
  };
}
