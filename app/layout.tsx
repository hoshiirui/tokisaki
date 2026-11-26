import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kalender Sesi Foto",
  description: "Lihat tanggal yang masih tersedia untuk booking sesi foto.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Inter:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <div className="wrap">
          <SiteNav />
        </div>
        {children}
      </body>
    </html>
  );
}
