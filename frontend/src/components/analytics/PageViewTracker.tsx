"use client";

import { useEffect } from "react";
import { trackPageView } from "@/lib/siteAnalytics";

/** Dispara un page_view al montar. Vive aparte porque la landing es un server component. */
export function PageViewTracker({ path }: { path: string }) {
  useEffect(() => { trackPageView(path); }, [path]);
  return null;
}
