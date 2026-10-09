import type { Metadata } from "next";
import Script from "next/script";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PriceGuardrail AI",
  description: "Governed, explainable pricing decisions for every SKU.",
};

const themeBootstrap = `(function(){try{var t=localStorage.getItem("priceguardrail_theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;return;}if(window.matchMedia("(prefers-color-scheme: light)").matches)document.documentElement.dataset.theme="light";}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
