import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GoogleProvider } from "@/components/providers/google-provider";
import { AppToaster } from "@/components/ui/app-toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ANGI — Ăn Gì", template: "%s | ANGI" },
  description: "Khám phá hương vị Việt Nam cùng ANGI.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      {/* Browser extensions (McAfee Web Advisor, password managers) can add
          attributes to <html>/<body> before hydration. suppressHydrationWarning
          only affects this element's own attributes. */}
      <body suppressHydrationWarning>
        <GoogleProvider>{children}</GoogleProvider>
        {/* Toasts of every page (notify in src/shared/ui/notify.ts). */}
        <AppToaster />
      </body>
    </html>
  );
}
