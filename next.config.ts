import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El indicador flotante de Next se sienta justo encima de la barra de
  // navegación en móvil y estorba al probar la app en el teléfono.
  devIndicators: false,
  experimental: {
    // El driver de Postgres no debe empaquetarse: se resuelve en Node.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
