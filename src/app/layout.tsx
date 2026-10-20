import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "WA Gateway", description: "WhatsApp gateway multi-nomor" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
