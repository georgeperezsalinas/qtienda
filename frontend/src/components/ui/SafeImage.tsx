"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { resolveMediaUrl } from "@/lib/media";

type SafeImageProps = Omit<ImageProps, "src" | "onError"> & {
  src: string;
  fallback?: React.ReactNode;
};

function shouldSkipOptimizer(src: string) {
  return src.startsWith("http://localhost") || src.startsWith("http://127.0.0.1");
}

export default function SafeImage({ src, fallback, unoptimized, ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveMediaUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (failed) {
    return (
      fallback ?? (
        <div className="w-full h-full flex items-center justify-center select-none text-3xl">
          🛍️
        </div>
      )
    );
  }

  return (
    <Image
      {...props}
      src={resolvedSrc}
      unoptimized={unoptimized ?? shouldSkipOptimizer(resolvedSrc)}
      onError={() => setFailed(true)}
    />
  );
}
