import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { ACCENTS, DEFAULT_ACCENT, DEFAULT_THEME, THEMES } from "@/lib/appearance";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

const sans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Caporal", template: "%s · Caporal" },
  description: "Control de inventario, minibares y dotación del hotel.",
  applicationName: "Caporal",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Caporal",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // el contenido debe llegar hasta el borde; el padding lo pone cada barra
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#232120" },
    { media: "(prefers-color-scheme: light)", color: "#f7f6f4" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const accent = jar.get("caporal_accent")?.value ?? DEFAULT_ACCENT;
  const theme = jar.get("caporal_theme")?.value ?? DEFAULT_THEME;

  return (
    <html
      lang="es-CO"
      data-accent={ACCENTS.some((a) => a.id === accent) ? accent : DEFAULT_ACCENT}
      data-theme={THEMES.includes(theme as never) ? theme : DEFAULT_THEME}
      className={`${sans.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-canvas text-ink">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
