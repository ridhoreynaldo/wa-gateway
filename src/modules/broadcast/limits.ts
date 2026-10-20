import { env } from "@/shared/env";

export const rand = (min: number, max: number) => min + Math.random() * Math.max(0, max - min);

/** Warm-up: hari ke-0 = 20 pesan, naik 25%/hari → ±200 pada hari ke-10. */
export function warmupLimit(startedAt: Date | null, now = new Date()): number {
  if (!startedAt) return 20;
  const day = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 86_400_000));
  return Math.round(20 * 1.25 ** day);
}

export function localParts(date = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: env().TZ_APP,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = Number(p.hour);
  return {
    hour,
    minute: Number(p.minute),
    dayKey: `${p.year}${p.month}${p.day}`,
    hourKey: `${p.year}${p.month}${p.day}${p.hour}`,
  };
}

export const inWindow = (hour: number, start: number, end: number) => hour >= start && hour < end;

/** ms sampai jam buka berikutnya (+ jitter 0–10 menit supaya tidak tepat jam). */
export function msUntilWindow(hour: number, minute: number, start: number): number {
  const h = (((start - hour) % 24) + 24) % 24 || 24;
  return Math.max(60_000, (h * 60 - minute) * 60_000 + rand(0, 600_000));
}

export function msUntilNextHour(minute: number): number {
  return (60 - minute) * 60_000 + rand(10_000, 180_000);
}
