import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GoogleProvider } from "@/components/providers/google-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ANGI — Ăn Gì", template: "%s | ANGI" },
  description: "Khám phá hương vị Việt Nam cùng ANGI.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <GoogleProvider>{children}</GoogleProvider>
      </body>
    </html>
  );
}
