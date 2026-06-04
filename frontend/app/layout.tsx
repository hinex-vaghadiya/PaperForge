import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hinex PaperForge — Digitize Questions. Build Papers. Save Time.",
  description:
    "AI-powered Question Bank and Question Paper Generator for English Pathshala. Upload textbook images, extract questions via OCR, and build professional exam papers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
