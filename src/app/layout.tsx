import type { ReactNode } from "react";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import { ThemeProvider } from "@/context/ThemeContext";
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
  weight: ["300", "400", "700"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata = {
  title: "mameko",
  description: "Artisanal Craftsmanship",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${tenor.variable} ${lato.variable}`} suppressHydrationWarning>
      <head>
        {/* Resource Hints: Preconnect prioritas tinggi ke API Backend (-300ms LCP) & Cloudinary */}
        <link rel="preconnect" href="https://api.mameko.my.id" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.mameko.my.id" />
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
      </head>
      <body className="font-lato antialiased">
        <ThemeProvider>
          <StoreProvider>
            {children}
            <Toaster
              position="bottom-left"
              toastOptions={{
                duration: 3000,
                style: {
                  background: "#333",
                  color: "#fff",
                  borderRadius: "8px",
                },
              }}
            />
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
