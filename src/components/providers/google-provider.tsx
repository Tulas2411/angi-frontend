"use client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import type { ReactNode } from "react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** Google sign-in is optional: without a client id the login page simply omits its button. */
export function GoogleProvider({ children }: { children: ReactNode }) {
  if (!GOOGLE_CLIENT_ID) return <>{children}</>;
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  );
}
