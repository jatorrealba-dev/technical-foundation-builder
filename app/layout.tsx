import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Technical Foundation Builder",
    template: "%s | Technical Foundation Builder",
  },
  description:
    "Transforma una idea de producto en un modelo técnico estructurado, documentos versionados y una base preparada para agentes de IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
