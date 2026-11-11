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
      <body>{children}</body>
    </html>
  );
}
