"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refresh data server component secara berkala (mis. progress broadcast). */
export function AutoRefresh({ ms = 5000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [router, ms]);
  return null;
}
