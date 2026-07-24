"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

const APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";

export function FacebookAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!APP_ID || window.FB || document.getElementById("facebook-jssdk")) return;

    window.fbAsyncInit = () => {
      window.FB.init({ appId: APP_ID, cookie: true, xfbml: false, version: "v19.0" });
    };

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/es_LA/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  return <>{children}</>;
}
