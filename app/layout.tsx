import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "CONNECT · NOVOGEN",
  description: "Plataforma comercial multiempresa de SOLVEX. Piloto NOVOGEN.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head>
        <link
          rel="preload"
          href="/brand/montserrat-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/brand/montserrat-700.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
