"use client";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Falls back to a placeholder so the Provider always mounts.
// The button hides itself when this is not a real Client ID.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "not-configured";

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  return <GoogleOAuthProvider clientId={CLIENT_ID}>{children}</GoogleOAuthProvider>;
}
