import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { PwaProvider } from "@/context/PwaContext";
import { Toaster } from "react-hot-toast";
import { Tenor_Sans, Lato } from "next/font/google";

// Setup Font (Self-hosted otomatis via Next.js dengan display: swap untuk 0ms render delay)
const tenor = Tenor_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-tenor",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
  display: "swap",
});

import { CookieConsent } from "@/components/CookieConsent/CookieConsent";
import { MaintenanceGuard } from "@/components/Maintenance/MaintenanceGuard";

export const metadata: Metadata = {
  title: "MAMEKO",
  description: "Artisanal Craftsmanship",
  applicationName: "MAMEKO",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MAMEKO",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0F12" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${tenor.variable} ${lato.variable}`} suppressHydrationWarning>
      <head>
        {/* Resource Hints: Preconnect prioritas tinggi ke API Backend (-300ms LCP) & Cloudinary */}
        <link rel="preconnect" href="https://api.mameko.my.id" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.mameko.my.id" />
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
      </head>
      <body className="font-lato antialiased">
        <ThemeProvider>
          <PwaProvider>
            <StoreProvider>
              <MaintenanceGuard>
                {children}
              </MaintenanceGuard>
              <CookieConsent />
              <Toaster
                position="bottom-left"
                containerStyle={{
                  bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
                }}
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: "var(--surface-primary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    boxShadow: "var(--shadow-md)",
                    fontSize: "0.875rem",
                    fontFamily: "var(--font-sans)",
                  },
                }}
              />
            </StoreProvider>
          </PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
