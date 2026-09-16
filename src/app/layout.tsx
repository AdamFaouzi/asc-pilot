import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ASC-Pilot",
  description: "Find local businesses without a website, build them one, and offer it as a subscription.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
