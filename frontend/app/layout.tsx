import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PriceGuardrail AI",
  description: "Governed, explainable pricing decisions for every SKU.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="dark"><body>{children}</body></html>;
}
