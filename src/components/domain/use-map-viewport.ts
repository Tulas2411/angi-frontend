"use client";
import { useEffect, useRef, useState } from "react";

export function useMapViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 960, height: 720 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(
        1,
        Math.min(1280, Math.round(entry.contentRect.width)),
      );
      const height = Math.max(
        1,
        Math.min(1280, Math.round(entry.contentRect.height)),
      );
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}
